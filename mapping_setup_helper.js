const siteLibrary = require('@sv/siteLib');
const fileSystem = require('fs');
const fileLibrary = require('@sv/fsLib');
const miscellaneousLibrary = require('@sv/miscLib');

// Update to your client names
const initialClient = '';
const redesignClient = '';

const mappingConfigurations = [
	// ------------------
	// Result explanation https://app.screencast.com/BXhFILQdjpnOS
	// This script is still in development. Make sure to have the GROUP specified. Don't include prefixes like plugins_common_
	//  Things you need: group, from, and to
	// ------------------
	
	// {
	// 	group: 'collection',
	// 	from: 'header_slideshow_interior',
	// 	to: 'core_v2_hero_image',
	// },
	// {
	// 	group: 'panel',
	// 	from: 'three_col_even',
	// 	to: 'three_col',
	// },
	// {
	// 	group: 'widget',
	// 	from: 'gdpr_banner',
	// 	to: 'cookie_banner',
	// },
];

// ----------------- DO NOT EDIT BELOW THIS LINE -----------------

return initialize();

async function initialize() {
	try {
		const initialConfiguration = await loadYAMLConfig(initialClient);
		const redesignConfiguration = await loadYAMLConfig(redesignClient);
		const sheets = await getSheets(redesignClient);

		if (!initialConfiguration) {
			return initialClient + ' was not found';
		}

		if (!redesignConfiguration) {
			return redesignClient + ' was not found';
		}

		if (sheets) {
			// console.log(sheets);
			// return JSON.stringify(sheets, null, 2);
		}
		// Get list of all fields
		const mappingResults = await performMapping(initialConfiguration, redesignConfiguration);

		return mappingResults;
	} catch (error) {
		console.log(error);
		return error.message;
	}
}

async function performMapping(initialConfiguration, redesignConfiguration) {
	if (!mappingConfigurations.length) {
		return 'No mapping configurations found';
	}
	try {
		const mappingResults = mappingConfigurations
			.map(({ group, to: target, from: source }) => {
				if (!target || !source) {
					return `{\n		target or source were not provided\n},\n`;
				}

				if (group === 'collection') {
					return mapCollections(initialConfiguration, redesignConfiguration, source, target);
				} else if (group === 'panel') {
					return mapPanels(initialConfiguration, redesignConfiguration, source, target);
				} else if (group === 'widget') {
					return mapWidgets(initialConfiguration, redesignConfiguration, source, target);
				} else {
					return `{\n		Group not found\n},\n\n`;
				}
			})
			.join('');

		return mappingResults;
	} catch (error) {
		console.log(error);
		return error.message;
	}
}

function mapWidgets(initialConfiguration, redesignConfiguration, from, to) {
	const initialWidgetFields = miscellaneousLibrary.varLookup(
		initialConfiguration,
		`settings.plugins.common.settings.widgets`
	);
	const redesignWidgetFields = miscellaneousLibrary.varLookup(
		redesignConfiguration,
		`settings.plugins.common.settings.widgets`
	);
	const sourceFields = extractFields(initialWidgetFields, from);
	const targetFields = extractFields(redesignWidgetFields, to);

	if (typeof targetFields === 'string') {
		return `{\n		Redesign config doesn't have ${to}\n},\n\n`;
	}
	if (typeof sourceFields === 'string') {
		return `{\n		Initial config doesn't have ${from}\n},\n\n`;
	}

	const {
		matchedFields,
		mismatchedFields,
		remainingInitialFields: remainingInitialFields,
		remainingRedesignFields,
	} = findMatchingFields(sourceFields, targetFields);

	const fieldsBlock = generateFieldsBlockForWidgets(
		matchedFields,
		mismatchedFields,
		remainingInitialFields,
		remainingRedesignFields
	);
	return generateWidgetCodeBlock(from, to, fieldsBlock);
}

function mapPanels(initialConfiguration, redesignConfiguration, from, to) {
	const initialPanelFields = miscellaneousLibrary.varLookup(
		initialConfiguration,
		`settings.plugins.common.settings.panels`
	);
	const redesignPanelFields = miscellaneousLibrary.varLookup(
		redesignConfiguration,
		`settings.plugins.common.settings.panels`
	);
	const logs = [];

	let sourcePanel = initialPanelFields.find((obj) => obj.name === from);
	let targetPanel = redesignPanelFields.find((obj) => obj.name === to);

	if (sourcePanel === undefined) {
		return `{\n		Initial config doesn't have ${from}\n},\n\n`;
	}
	if (targetPanel === undefined) {
		return `{\n		Redesign config doesn't have ${to}\n},\n\n`;
	}

	if (!sourcePanel?.fields || !targetPanel?.fields) {
		logs.push(`\n{\n		No fields to match.\n},\n`);
		// THIS NEEDS MORE REFINING AND TESTING
	}

	const sectionComparison = compareSections(sourcePanel, targetPanel);

	const sourceFields = extractFields(initialPanelFields, from);
	const targetFields = extractFields(redesignPanelFields, to);

	if (!sourceFields || !targetFields) {
		logs.push(`\n{\n		No fields to match.\n},\n`);
		// THIS NEEDS MORE REFINING AND TESTING
	}

	if (typeof targetFields === 'string') {
		return `{\n		Redesign config doesn't have ${to}\n},\n\n`;
	}
	if (typeof sourceFields === 'string') {
		return `{\n		Initial config doesn't have ${from}\n},\n\n`;
	}

	const { matchedFields, mismatchedFields, remainingInitialFields, remainingRedesignFields } = findMatchingFields(
		sourceFields,
		targetFields
	);

	const fieldsBlock = generateFieldsBlock(
		matchedFields,
		mismatchedFields,
		remainingInitialFields,
		remainingRedesignFields
	);

	return generatePanelCodeBlock(from, to, sectionComparison, fieldsBlock);
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
							unmatchedTargetSections.length ? ' Use Redesign sections to map the remaining sections' : ''
					  } `
					: `${unmatchedTargetSections.length ? 'Use Redesign sections to map the following' : ''}`
			}

			${
				unmatchedSourceSections.length
					? unmatchedSourceSections.map((section) => `\n			// '${section}' :  'TODO',`).join('')
					: ''
			}

			${
				unmatchedTargetSections.length
					? `\n			// ----- INITIAL SECTIONS ----- //\n			// '${unmatchedTargetSections.reverse().join("', '")}'`
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
	},
	${fieldsBlock}\n},\n`;
}
function generateCollectionCodeBlock(source, target, fieldsBlock) {
	return `{
	from: '${source}',
	to: '${target}',
	${fieldsBlock}\n},\n`;
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

function mapCollections(initialConfiguration, redesignConfiguration, source, target) {
	// Get list of all fields
	const initialCollectionFields = miscellaneousLibrary.varLookup(
		initialConfiguration,
		`settings.plugins.collections.settings.templates`
	);
	const redesignCollectionFields = miscellaneousLibrary.varLookup(
		redesignConfiguration,
		`settings.plugins.collections.settings.templates`
	);

	const sourceFields = extractFields(initialCollectionFields, source);
	const targetFields = extractFields(redesignCollectionFields, target);

	if (typeof targetFields === 'string') {
		return `{\n		Redesign config doesn't have ${target}\n},\n\n`;
	}
	if (typeof sourceFields === 'string') {
		return `{\n		Initial config doesn't have ${source}\n},\n\n`;
	}

	const { matchedFields, mismatchedFields, remainingInitialFields, remainingRedesignFields } = findMatchingFields(
		sourceFields,
		targetFields
	);

	const fieldsBlock = generateFieldsBlock(
		matchedFields,
		mismatchedFields,
		remainingInitialFields,
		remainingRedesignFields
	);
	return generateCollectionCodeBlock(source, target, fieldsBlock);
}

function findMatchingFields(sourceFields, targetFields) {
	if (typeof sourceFields === 'string') {
		sourceFields = [];
	}
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

	const remainingInitialFields = sourceFields
		? sourceFields.filter((field) => !matchedFields.includes(field.name))
		: [];
	const remainingRedesignFields = targetFields
		? targetFields.filter((field) => !matchedFields.includes(field.name))
		: [];

	return { matchedFields, mismatchedFields, remainingInitialFields, remainingRedesignFields };
}

function generateFieldsBlock(matchedFields, mismatchedFields, remainingInitialFields, remainingRedesignFields) {
	return `cb: (fields) => {${
		matchedFields.length ? `\n\n		// ${matchedFields.map((field) => `'${field}'`).join(', ')} exist in both. ` : ''
	}${
		mismatchedFields.length
			? `But, Some fields have matched with mismatched types. (${mismatchedFields.map(
					(field) => `'${field.fieldName}'`
			  )}). `
			: ''
	}

		${
			remainingInitialFields.length
				? `// [INITIAL FIELDS]\n		${remainingInitialFields
						.map((field) => `// fields.REDESIGN_FIELD = fields.${field.name};`)
						.join('\n		')}`
				: "// The old template doesn't have any fields!"
		}
		${remainingRedesignFields.some((field) => field.required) ? '\n\n		// [REQUIRED REDESIGN FIELDS]' : ''}
		${remainingRedesignFields
			.filter((field) => field.required)
			.map((field) => `fields.${field.name} = 'DEFAULT';`)
			.join('\n		')}

		// [REMAINING REDESIGN FIELDS]
		${
			remainingRedesignFields
				? remainingRedesignFields
						.filter((field) => !field.required)
						.map(
							(field) =>
								`// '${field.name}' ${
									field?.moduleForm?.options && field?.moduleForm?.options.length > 0
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

		// [DELETE]
		${
			remainingInitialFields.length
				? remainingInitialFields.map((field) => `delete fields.${field.name};`).join('\n		')
				: '// Nothing to delete!'
		}

		return fields;
	}`;
}

function extractFields(instanceSetup, name) {
	const res = Array.isArray(findFields(instanceSetup, name))
		? findFields(instanceSetup, name).map(normalizeField)
		: findFields(instanceSetup, name);

	return res;
}

// Helper function to normalize field object (if template exists, use it as type)
function normalizeField(field) {
	return { ...field, type: field.template || field.type };
}

function findFields(arrOfObjects, instanceName) {
	const res = arrOfObjects.find((obj) => obj.name === instanceName);
	if (res) {
		return res.fields || [];
	} else {
		return instanceName + ' not found!';
	}
}

function generateWidgetCodeBlock(source, target, fieldsBlock) {
	return `{{
	from: 'plugins_common_${source}',
	to: 'plugins_common_${target}',
	update: [
		${fieldsBlock}
	]
},\n`;
}

function generateFieldsBlockForWidgets(
	matchedFields,
	mismatchedFields,
	remainingInitialFields,
	remainingRedesignFields
) {
	return `${
		matchedFields.length
			? `	// ${matchedFields.map((field) => `'${field}'`).join(', ')} matched in both widgets. ${
					mismatchedFields.length
						? ' But some appear to have mismatched types (' +
						  mismatchedFields.map((field) => `'${field.fieldName}'`).join(', ') +
						  ')'
						: ''
			  }`
			: ''
	}${
		remainingInitialFields.length && remainingRedesignFields.length
			? `\n		{\n			$rename: {
				${
					remainingInitialFields.length
						? remainingInitialFields
								.map((field) => `// 'data.${field.name}': 'data.REDESIGN_FIELD',`)
								.join('\n				')
						: ''
				}\n
				// ------ REDESIGN FIELDS ------ //
				${remainingRedesignFields.length ? `// ${remainingRedesignFields.map((field) => `'${field.name}'`).join(',')}` : ''}
			}
		},`
			: ''
	}
		${
			remainingRedesignFields.length
				? `{
			$set: {
				${remainingRedesignFields.map((field) => `// 'data.${field.name}': 'DEFAULT',`).join('\n				')}
			}
		},`
				: ''
		}`;
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
	const csvPath = `${rootPath}/public/mapping_sheet.csv`;
	let csvExists = true;

	try {
		await fileSystem.promises.stat(csvPath);
	} catch (error) {
		csvExists = false;
	}

	if (csvExists) {
		// console.log(csvExists)
		try {
			const config = await readCSV(csvPath);
			return config;
		} catch (error) {
			console.error('Error reading CSV:', error);
			return null;
		}
	}
	return null;
}
async function readCSV(filePath) {
	const data = await fileSystem.promises.readFile(filePath, 'utf8');
	const rows = data.split('\n');
	const headers = rows[0].split(',').map((header) => header.trim());

	return rows.slice(1).map((row) => {
		const values = row.split(',').map((value) => value.trim());

		const instance = headers.reduce((instance, header, index) => {
			if (values[index]) {
				instance[header] = values[index];
			}

			return instance;
		}, {});

		let mappingConfigurations = [];

		if (instance['status'] === 'MAP') {
			mappingConfigurations.push({
				group: instance[headers[headers.indexOf('type')]],
				from: instance[headers[headers.indexOf('find_name')]],
				to: instance[headers[headers.indexOf('map_to')]],
			});
		}

		return mappingConfigurations;
	});
}
