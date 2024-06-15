const initialClient = 'amarillo';
const redesignClient = 'amarillo-redesign';
const xmlPath = '/includes/client_public/mapping_sheet.xlsx';

const siteLibrary = require('@sv/siteLib');
const fileSystem = require('fs');
const fileLibrary = require('@sv/fsLib');
const miscellaneousLibrary = require('@sv/miscLib');
const { log } = require('console');

const sheet = `${site.sv_site_config.siteConfigs.primary.urlNoSlash}${xmlPath}`;

const mappingConfigurations = [
	// {
	// 	group: 'collection',
	// 	from: 'header_slideshow_blog',
	// 	to: 'core_v2_hero_slideshow',
	// },
	// {
	// 	group: 'collection',
	// 	from: 'header_slideshow_homepage',
	// 	to: 'core_v2_hero_slideshow',
	// },
	{
		group: 'collection',
		from: 'deco_slider',
		to: 'slider_preview_with_header_2_across_fullwidth',
	},
	// Panels
	{
		from: 'two_col_sidebar_right',
		to: 'two_col',
		group: 'panel',
	},
	// {
	// 	from: 'two_col_even',
	// 	to: 'two_col',
	// 	group: 'panel',
	// },
	{
		from: 'nav_share',
		to: 'container_navigation_share',
		group: 'panel',
	},
	{
		from: 'three_col_even',
		to: 'three_col',
		group: 'panel',
	},
];

return initialize();

async function initialize() {
	try {
		const initialConfiguration = await loadYAMLConfig(initialClient);
		const redesignConfiguration = await loadYAMLConfig(redesignClient);
		const sheets = await getSheets(initialClient);

		if (!initialConfiguration) {
			return initialClient + ' was not found';
		}

		if (!redesignConfiguration) {
			return redesignClient + ' was not found';
		}

		// if (!sheets) {
		// 	return 'No mapping sheets found';
		// }
		// Get list of all fields
		const mappingResults = await performMapping(initialConfiguration, redesignConfiguration);

		return mappingResults;
	} catch (error) {
		console.log(error);
		return error.message;
	}
}

async function performMapping(initialConfiguration, redesignConfiguration) {
	try {
		const mappingResults = mappingConfigurations
			.map(({ group, to: target, from: source }) => {
				if (group === 'collection') {
					return mapCollectionFields(initialConfiguration, redesignConfiguration, source, target);
				} else if (group === 'panel') {
					return mapPanelFields(initialConfiguration, redesignConfiguration, source, target);
				}
			})
			.join('');

		return mappingResults;
	} catch (error) {
		console.log(error);
		return error.message;
	}
}

function mapPanelFields(initialConfiguration, redesignConfiguration, source, target) {
	const initialPanelFields = miscellaneousLibrary.varLookup(
		initialConfiguration,
		`settings.plugins.common.settings.panels`
	);
	const redesignPanelFields = miscellaneousLibrary.varLookup(
		redesignConfiguration,
		`settings.plugins.common.settings.panels`
	);
	const logs = [];

	let sourcePanel = initialPanelFields.find((obj) => obj.name === source);
	let targetPanel = redesignPanelFields.find((obj) => obj.name === target);

	if (sourcePanel !== undefined || targetPanel !== undefined) {
		let missingFields = [];
		if (sourcePanel === undefined) {
			missingFields.push(source + ' missing in ' + initialClient);
		}
		if (targetPanel === undefined) {
			missingFields.push(target + ' missing in ' + redesignClient);
		}
		// THIS NEEDS MORE REFINING AND TESTING
	}

	if (!sourcePanel?.fields || !targetPanel?.fields) {
		logs.push(`\n{\n		No fields to match.\n},\n`);
		// THIS NEEDS MORE REFINING AND TESTING
	}

	const sectionComparison = compareSections(sourcePanel, targetPanel);

	const sourceFields = extractPanelFields(initialPanelFields, source);
	const targetFields = extractPanelFields(redesignPanelFields, target);

	if (!sourceFields || !targetFields) {
		logs.push(`\n{\n		No fields to match.\n},\n`);
		// THIS NEEDS MORE REFINING AND TESTING
	}

	const { matchedFields, mismatchedFields, fieldsToMapOrDelete, optionalRedesignFields } = findMatchingFields(
		sourceFields,
		targetFields
	);

	const fieldsBlock = generateFieldsBlock(
		matchedFields,
		mismatchedFields,
		fieldsToMapOrDelete,
		optionalRedesignFields
	);

	return generatePanelCodeBlock(sourcePanel.name, targetPanel.name, sectionComparison, fieldsBlock);
}

function compareSections(sourcePanel, targetPanel) {
	let logs = [];

	const sourceSections = sourcePanel?.rows
		? flattenSections(sourcePanel.rows)
		: 'No sections found in ' + sourcePanel.name;
	const targetSections = targetPanel?.rows
		? flattenSections(targetPanel.rows)
		: 'No sections found in ' + targetPanel.name;

	const { matchedItems, unmatchedSourceSections, unmatchedTargetSections } = matchSections(
		targetSections,
		sourceSections
	);
	logs.push(`\n
			// ${
				matchedItems.length
					? `'${matchedItems.join("', '")}' matched in both panels.${
							unmatchedTargetSections.length ? ' Use Options to map the following' : ''
					  } `
					: `${unmatchedTargetSections.length ? 'Use Options to map the following' : ''}`
			}
				${
					unmatchedTargetSections.length
						? unmatchedTargetSections.map((section) => `\n			// 'TODO' :  '${section}',`).join('')
						: ''
				}
				${
					unmatchedSourceSections.length
						? `\n			// ----- Options ----- //\n			// '${unmatchedSourceSections.reverse().join("', '")}'`
						: ''
				}
`);

	return logs;
}

function matchSections(targetSections, sourceSections) {
	// Find matched items
	const matchedItems = targetSections.filter((item) => sourceSections.includes(item));

	// Find unmatched items in targetSections
	const unmatchedTargetSections = targetSections.filter((item) => !sourceSections.includes(item));

	// Find unmatched items in sourceSections
	const unmatchedSourceSections = sourceSections.filter((item) => !targetSections.includes(item));

	return {
		unmatchedTargetSections,
		unmatchedSourceSections,
		matchedItems,
	};
}

function generatePanelCodeBlock(source, target, sectionComparison, fieldsBlock) {
	return `{
	from: '${source}',
	to: '${target}',
	mapSections: {${sectionComparison}
	},\n				${fieldsBlock}\n},\n`;
}

function flattenSections(section) {
	// Initialize an empty array to hold the flattened individual items
	let items = [];

	// Define a recursive function to traverse and extract items
	function extractItems(item) {
		// Check if the section is an array
		if (Array.isArray(item)) {
			// If it's an array, recursively process each element
			item.forEach((subSection) => extractItems(subSection));
		} else if (item.columns || item.rows) {
			// If it has columns or rows, recursively process each
			if (item.columns) {
				item.columns.forEach((column) => extractItems(column));
			}
			if (item.rows) {
				item.rows.forEach((row) => extractItems(row));
			}
		}
		// If the section is an individual item with `name`, `label`, and `accepts`
		else if (item.name && item.label && item.accepts) {
			// Add the individual item to the `items` array
			items.push(item.name);
		}
	}

	// Start the recursive extraction process
	extractItems(section);

	// Return the flattened items array
	return items;
}

function mapCollectionFields(initialConfiguration, redesignConfiguration, source, target) {
	// Get list of all fields
	const initialCollectionFields = miscellaneousLibrary.varLookup(
		initialConfiguration,
		`settings.plugins.collections.settings.templates`
	);
	const redesignCollectionFields = miscellaneousLibrary.varLookup(
		redesignConfiguration,
		`settings.plugins.collections.settings.templates`
	);
	const dataLog = [];

	const sourceFields = extractPanelFields(initialCollectionFields, source);
	const targetFields = extractPanelFields(redesignCollectionFields, target);

	const { matchedFields, mismatchedFields, fieldsToMapOrDelete, optionalRedesignFields } = findMatchingFields(
		sourceFields,
		targetFields
	);

	return generateCodeBlock(
		source,
		target,
		matchedFields,
		mismatchedFields,
		fieldsToMapOrDelete,
		optionalRedesignFields
	);
}

function findMatchingFields(sourceFields, targetFields) {
	const matchedFields = sourceFields
		? sourceFields
				.filter((field) =>
					targetFields.some(
						(f) => f.name === field.name && (f.type === field.type || f.template === field.template)
					)
				)
				.map((field) => field.name)
		: [];

	const mismatchedFields = sourceFields
		? sourceFields.reduce((acc, field) => {
				const targetField = targetFields.find((f) => f.name === field.name);
				if (targetField && field.type !== targetField.type) {
					acc.push({ fieldName: field.name, type: field.type, redesignType: targetField.type });
				}
				return acc;
		  }, [])
		: [];

	const fieldsToMapOrDelete = sourceFields ? sourceFields.filter((field) => !matchedFields.includes(field.name)) : [];
	const optionalRedesignFields = targetFields
		? targetFields.filter((field) => !matchedFields.includes(field.name))
		: [];

	return { matchedFields, mismatchedFields, fieldsToMapOrDelete, optionalRedesignFields };
}

function generateCodeBlock(
	source,
	target,
	matchedFields,
	mismatchedFields,
	fieldsToMapOrDelete,
	optionalRedesignFields
) {
	return `
{
	from: '${source}',
	to: '${target}',
	cb: (fields) => {${
		matchedFields.length ? `\n\n		// ${matchedFields.map((field) => `${field}`).join(', ')} exist in both. ` : ''
	}${
		mismatchedFields.length
			? '\n\n		// Some fields have matched with mismatched types. Check _Extra in the console.'
			: ''
	}

		// [Optional MAP]
		${
			fieldsToMapOrDelete.length
				? fieldsToMapOrDelete.map((field) => `// fields.target_field = fields.${field.name};`).join('\n		')
				: "// The old template doesn't have any fields!"
		}

		// [DELETE]
		${
			fieldsToMapOrDelete.length
				? fieldsToMapOrDelete.map((field) => `delete fields.${field.name};`).join('\n		')
				: '// Nothing to delete!'
		}

		// [REDESIGN FIELDS]
		${
			optionalRedesignFields
				? optionalRedesignFields
						.map((field) => `// ${field.name} ${field.required ? '(required)' : ''}`)
						.join('\n		')
				: ''
		}

		return fields;
	}
},
`;
}

function generateFieldsBlock(matchedFields, mismatchedFields, fieldsToMapOrDelete, optionalRedesignFields) {
	console.log(optionalRedesignFields);
	return `
	cb: (fields) => {${
		matchedFields.length ? `\n\n		// ${matchedFields.map((field) => `${field}`).join(', ')} exist in both. ` : ''
	}${
		mismatchedFields.length
			? '\n\n		// Some fields have matched with mismatched types. Check _Extra in the console.'
			: ''
	}

		// [Optional MAP]
		${
			fieldsToMapOrDelete.length
				? fieldsToMapOrDelete.map((field) => `// fields.target_field = fields.${field.name};`).join('\n		')
				: "// The old template doesn't have any fields!"
		}

		// [DELETE]
		${
			fieldsToMapOrDelete.length
				? fieldsToMapOrDelete.map((field) => `delete fields.${field.name};`).join('\n		')
				: '// Nothing to delete!'
		}

		// [REDESIGN FIELDS]
		${
			optionalRedesignFields
				? optionalRedesignFields
						.map(
							(field) =>
								`// '${field.name}' ${
									field.required
										? `(required) ${
												field?.moduleForm?.options
													? `with ${
															field?.moduleForm?.options.length
													  } options: ${field?.moduleForm?.options
															.map((option) => "'" + option.value + "'")
															.join(', ')}`
													: ''
										  }`
										: field?.moduleForm?.options && field?.moduleForm?.options.length > 0
										? `with ${
												field?.moduleForm?.options.length
										  } options: ${field?.moduleForm?.options
												.map((option) => "'" + option.value + "'")
												.join(', ')}`
										: ''
								}`
						)
						.join('\n		')
				: ''
		}

		return fields;
	}
`;
}

function extractPanelFields(instanceSetup, name) {
	const fields = findFields(instanceSetup, name);

	if (!fields) {
		return;
	}

	return fields.map(normalizeField);
}

// Helper function to normalize field object (if template exists, use it as type)
function normalizeField(field) {
	return { ...field, type: field.template || field.type };
}

function findFields(arrOfObjects, objectName) {
	const foundObject = arrOfObjects.find((obj) => obj.name === objectName);
	if (foundObject) {
		return foundObject.fields || null;
	}
	return objectName;
}

async function loadYAMLConfig(clientName) {
	const rootPath = `${siteLibrary.getServerPath()}clients/${clientName}`;
	const yamlPath = `${rootPath}/clientConfig.yaml`;
	let yamlExists = true;
	try {
		await fileSystem.promises.stat(yamlPath);
	} catch (error) {
		yamlExists = false;
	}

	if (yamlExists) {
		const config = await fileLibrary.promises.readYAML(yamlPath);
		return config;
	}
	return null;
}
async function getSheets(clientName) {
	const rootPath = `${siteLibrary.getServerPath()}clients/${clientName}`;
	const sheetsPath = `${rootPath}/client/mapping_sheets.xlsx`;

	let sheetsExists = true;
	try {
		await fileSystem.promises.stat(sheet);
	} catch (error) {
		sheetsExists = false;
	}

	if (sheetsExists) {
		const workbook = xlsx.readFile(sheetsPath);
		const sheetName = workbook.SheetNames[0];
		const sheet = workbook.Sheets[sheetName];
		const jsonData = xlsx.utils.sheet_to_json(sheet);
		return jsonData;
	}
	return null;
}
