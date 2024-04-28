const client = 'amarillo';
const client_redesign = 'amarillo-redesign';

const siteLib = require('@sv/siteLib');
const fs = require('fs');
const fsLib = require('@sv/fsLib');
const miscLib = require('@sv/miscLib');

const mappingSetup = [
	{
		from: 'header_slideshow_blog',
		to: 'core_v2_hero_slideshow',
	},
	{
		from: 'header_slideshow_homepage',
		to: 'core_v2_hero_slideshow',
	},
	{
		from: 'deco_slider',
		to: 'slider_preview_with_header_2_across_fullwidth',
	},
];

async function main() {
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
		const clientCollections = miscLib.varLookup(initialConfig, `settings.plugins.collections.settings.templates`);
		const clientRedesignCollections = miscLib.varLookup(
			redesignConfig,
			`settings.plugins.collections.settings.templates`
		);
		const log = [];

		const mappingResults = mappingSetup.map(({ from, to }) => {
			let fromFields = getObjectFields(clientCollections, from);
			let toFields = getObjectFields(clientRedesignCollections, to);

			// If either is not found, return an error
			if (typeof fromFields === 'string' || typeof toFields === 'string') {
				let notFound = [];
				if (typeof fromFields === 'string') {
					notFound.push(fromFields + ' (Old Client)');
				}
				if (typeof toFields === 'string') {
					notFound.push(toFields + ' (Redesign)');
				}

				return `\n{\n		Widget not found:\n		${notFound.join('\n		')}\n}`;
			}

			fromFields = fromFields.map(normalizeField);
			toFields = toFields.map(normalizeField);

			// Find matched fields (name and either type or template)
			const matched_fields = fromFields
				.filter((field) =>
					toFields.some(
						(f) => f.name === field.name && (f.type === field.type || f.template === field.template)
					)
				)
				.map((field) => field.name);

			// Find fields with mismatched types (using a separate loop for clarity)
			const matched_but_wront_type = fromFields.reduce((acc, field) => {
				const toField = toFields.find((f) => f.name === field.name);
				if (toField && field.type !== toField.type) {
					acc.push({ fieldName: field.name, type: field.type, redesignType: toField.type });
				}
				return acc;
			}, []);

			const map_or_delete = fromFields.filter((field) => !matched_fields.includes(field.name));
			const optional_redesign_fields = toFields.filter((field) => !matched_fields.includes(field.name));
			log.push({
				['to_' + to]: {
					fields: toFields,
				},
				['from_' + from]: {
					fields: fromFields,
				},
				_Extra: {
					matched_fields,
					matched_but_wront_type,
				},
			});
			return codeBlock(from, to, matched_fields, matched_but_wront_type, map_or_delete, optional_redesign_fields);
		});

		console.log(log);
		return mappingResults.join('');
	} catch (e) {
		console.log(e);
		return e.message;
	}
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
// Helper function to normalize field object (if template exists, use it as type)
function normalizeField(field) {
	return { ...field, type: field.template || field.type };
}

return main();

function getObjectFields(arrOfObjects, objectName) {
	const foundObject = arrOfObjects.find((obj) => obj.name === objectName);
	if (foundObject) {
		return foundObject.fields || {};
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
