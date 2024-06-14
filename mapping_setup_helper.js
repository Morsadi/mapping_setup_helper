const client = 'amarillo';
const client_redesign = 'amarillo-redesign';

const siteLib = require('@sv/siteLib');
const fs = require('fs');
const fsLib = require('@sv/fsLib');
const miscLib = require('@sv/miscLib');
const { log } = require('console');

const mappingSetup = [
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
	// {
	// 	from: 'nav_share',
	// 	to: 'container_navigation_share',
	// 	group: 'panel',
	// },
	{
		from: 'three_col_even',
		to: 'three_col',
		group: 'panel',
	},
];

return init();

async function init() {
	try {
		const initialConfig = await getYAML(client);
		const redesignConfig = await getYAML(client_redesign);

		if (!initialConfig) {
			return client + ' was not found';
		}

		if (!redesignConfig) {
			return client_redesign + ' was not found';
		}
		// Get list of all fields
		mappingResults = await main(initialConfig, redesignConfig);

		return mappingResults;
	} catch (e) {
		console.log(e);
		return e.message;
	}
}

async function main(initialConfig, redesignConfig) {
	try {
		const mappingResults = mappingSetup
			.map(({ group, from, to }) => {
				if (group === 'collection') {
					return mapCollections(initialConfig, redesignConfig, from, to);
				} else if (group === 'panel') {
					return mapPanels(initialConfig, redesignConfig, from, to);
				}
			})
			.join('');

		return mappingResults;
	} catch (e) {
		console.log(e);
		return e.message;
	}
}

function mapPanels(initialConfig, redesignConfig, from, to) {
	const clientPanels = miscLib.varLookup(initialConfig, `settings.plugins.common.settings.panels`);
	const clientRedesignPanels = miscLib.varLookup(redesignConfig, `settings.plugins.common.settings.panels`);
	const dataStructure = ['test'];
	const logs = [];

	let fromInstance = clientPanels.find((obj) => obj.name === from);
	let toInstance = clientRedesignPanels.find((obj) => obj.name === to);

	if (fromInstance !== undefined || toInstance !== undefined) {
		let notFound = [];
		if (fromInstance === undefined) {
			notFound.push(from + ' missing in ' + client);
		}
		if (toInstance === undefined) {
			notFound.push(to + ' missing in ' + client_redesign);
		}
		// THIS NEEDS MORE REFINING AND TESTING
	}

	if (!fromInstance?.fields || !toInstance?.fields) {
		logs.push(`\n{\n		No fields to match.\n},\n`);
		// THIS NEEDS MORE REFINING AND TESTING
	}

	let extractedSection = handleSections(fromInstance, toInstance);

	let fromFields = extractFields(clientPanels, from);
	let toFields = extractFields(clientRedesignPanels, to);

	if (!fromFields || !toFields) {
		logs.push(`\n{\n		No fields to match.\n},\n`);
		// THIS NEEDS MORE REFINING AND TESTING
	}



	

	return panelCodeBlock(fromInstance.name, toInstance.name, extractedSection, 'Work in progress');
	// return [fromFields, toFields];
	// return JSON.stringify([fromFields, toFields], null, 2);
}

function handleSections(fromInstance, toInstance) {
	let logs = [];

	fromSections = fromInstance?.rows
		? flattenSections(fromInstance.rows)
		: 'No sections found in ' + fromInstance.name;
	toSections = toInstance?.rows ? flattenSections(toInstance.rows) : 'No sections found in ' + toInstance.name;

	const { matchedItems, unmatchedFromSections, unmatchedToSections } = matchSetup(toSections, fromSections);
	// .map(section => `\n			// 'sectionToChange' :  '${toSections[section]}',`).join('');
	logs.push(`\n
			// ${
				matchedItems.length
					? `'${matchedItems.join("', '")}' matched in both panels.${
							unmatchedToSections.length ? ' Use Options to map the following' : ''
					  } `
					: `${unmatchedToSections.length ? 'Use Options to map the following' : ''}`
			}
				${unmatchedToSections.length ? unmatchedToSections.map((section) => `\n			// 'TODO' :  '${section}',`).join('') : ''}
				${
					unmatchedFromSections.length
						? `\n			// ----- Options ----- //\n			// '${unmatchedFromSections.reverse().join("', '")}'`
						: ''
				}
`);

	return logs;
}

function matchSetup(toSections, fromSections) {
	// Find matched items
	const matchedItems = toSections.filter((item) => fromSections.includes(item));

	// Find unmatched items in toSections
	const unmatchedToSections = toSections.filter((item) => !fromSections.includes(item));

	// Find unmatched items in fromSections
	const unmatchedFromSections = fromSections.filter((item) => !toSections.includes(item));

	return {
		unmatchedToSections,
		unmatchedFromSections,
		matchedItems,
	};
}

function panelCodeBlock(from, to, extractedSection, extractedFields) {
	return `\n{
		from: '${from}',
		to: '${to}',
		mapSections: {${extractedSection}
		},
		cb: (fields) => {\n				${extractedFields}
		}\n},`;
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

function mapCollections(initialConfig, redesignConfig, from, to) {
	// Get list of all fields
	const clientCollections = miscLib.varLookup(initialConfig, `settings.plugins.collections.settings.templates`);
	const clientRedesignCollections = miscLib.varLookup(
		redesignConfig,
		`settings.plugins.collections.settings.templates`
	);
	const dataLog = [];

	// let fromFields = fetchFields(clientCollections, from);
	// let toFields = fetchFields(clientRedesignCollections, to);

	// if (typeof fromFields === 'string' || typeof toFields === 'string') {
	// 	let notFound = [];
	// 	if (typeof fromFields === 'string') {
	// 		notFound.push(fromFields + ' (Old Client)');
	// 	}
	// 	if (typeof toFields === 'string') {
	// 		notFound.push(toFields + ' (Redesign)');
	// 	}

	// 	return `\n{\n		Collection not found:\n		${notFound.join('\n		')}\n}`;
	// }

	let fromFields = extractFields(clientCollections, from);
	let toFields = extractFields(clientRedesignCollections, to);

	const matched_fields = fromFields
		.filter((field) =>
			toFields.some((f) => f.name === field.name && (f.type === field.type || f.template === field.template))
		)
		.map((field) => field.name);

	const matched_but_wrong_type = fromFields.reduce((acc, field) => {
		const toField = toFields.find((f) => f.name === field.name);
		if (toField && field.type !== toField.type) {
			acc.push({ fieldName: field.name, type: field.type, redesignType: toField.type });
		}
		return acc;
	}, []);

	const map_or_delete = fromFields.filter((field) => !matched_fields.includes(field.name));
	const optional_redesign_fields = toFields.filter((field) => !matched_fields.includes(field.name));

	dataLog.push({
		['to_' + to]: {
			fields: toFields,
		},
		['from_' + from]: {
			fields: fromFields,
		},
		_Extra: {
			matched_fields,
			matched_but_wrong_type,
		},
	});
	// console.log(dataLog);
	return codeBlock(from, to, matched_fields, matched_but_wrong_type, map_or_delete, optional_redesign_fields);
}

function codeBlock(from, to, matched_fields, matched_but_wront_type, map_or_delete, optional_redesign_fields) {
	return `
{
	from: '${from}',
	to: '${to}',
	cb: (fields) => {${
		matched_fields.length ? `\n\n		// ${matched_fields.map((field) => `${field}`).join(', ')} exist in both. ` : ''
	}${
		matched_but_wront_type.length
			? '\n\n		// Some fields have matched with mismatched types. Check _Extra in the console.'
			: ''
	}

		// [Optional MAP]
		${
			map_or_delete.length
				? map_or_delete.map((field) => `// fields.target_field = fields.${field.name};`).join('\n		')
				: "// The old template doesn't have any fields!"
		}

		// [DELETE]
		${
			map_or_delete.length
				? map_or_delete.map((field) => `delete fields.${field.name};`).join('\n		')
				: '// Nothing to delete!'
		}

		// [REDESIGN FIELDS]
		${
			optional_redesign_fields
				? optional_redesign_fields
						.map((field) => `// ${field.name} ${field.required ? '(required)' : ''}`)
						.join('\n		')
				: ''
		}

		return fields;
	}
},
`;
}

function extractFields(instanceSetup, name) {
	let fields = fetchFields(instanceSetup, name);

	if (!fields) {
		return;
	}

	return fields.map(normalizeField);
}

// Helper function to normalize field object (if template exists, use it as type)
function normalizeField(field) {
	return { ...field, type: field.template || field.type };
}

function fetchFields(arrOfObjects, objectName) {
	const foundObject = arrOfObjects.find((obj) => obj.name === objectName);
	if (foundObject) {
		return foundObject.fields || null;
	}
	return objectName;
}

async function getYAML(client) {
	const rootPath = `${siteLib.getServerPath()}clients/${client}`;
	const yamlPath = `${rootPath}/clientConfig.yaml`;
	let yamlExists = true;
	try {
		await fs.promises.stat(yamlPath);
	} catch (e) {
		yamlExists = false;
	}

	if (yamlExists) {
		const config = await fsLib.promises.readYAML(yamlPath);
		return config;
	}
	return null;
}
