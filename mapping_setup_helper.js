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
];

async function main() {
	try {
		const initialConfig = await getYAML(client);
		const redesignConfig = await getYAML(client_redesign);

		const clientCollections = miscLib.varLookup(initialConfig, `settings.plugins.collections.settings.templates`);
		const clientRedesignCollections = miscLib.varLookup(
			redesignConfig,
			`settings.plugins.collections.settings.templates`
		);

		const mappingResults = mappingSetup.map(({ from, to }) => {
			const fromFields = getObjectFields(clientCollections, from).map(normalizeField);
			const toFields = getObjectFields(clientRedesignCollections, to).map(normalizeField);

			// Find matched fields (name and either type or template)
			const matchedFields = fromFields
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
					acc.push({ fieldName: field.name, type: field.type });
				}
				return acc;
			}, []);

			const map_or_delete = fromFields.filter((field) => !matchedFields.includes(field.name));
			const optional_redesign_fields = toFields.filter((field) => !matchedFields.includes(field.name));
			console.log({ from, to, cd: { map_or_delete, optional_redesign_fields, matched_but_wront_type } });

			const codeBlock = `
{
	from: '${from}',
	to: '${to}',
	cb: (fields) => {
		// Automatic ${matchedFields.map((field) => `${field.name}`).join(', ')}

		// [MAP]
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

		[REDESIGN FIELDS]
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

			return codeBlock;
		});

		console.log(mappingResults);
		return mappingResults.join('');
	} catch (e) {
		console.log(e);
		return e.message;
	}
}

function explainMap(from, to, map_or_delete, optional_redesign_fields) {
	return codeBlock;
}

// Helper function to normalize field object (if template exists, use it as type)
function normalizeField(field) {
	return { ...field, type: field.template || field.type };
}

main();

return main() || 'Nothing got pushed!';

function getObjectFields(arrOfObjects, objectName) {
	const foundObject = arrOfObjects.find((obj) => obj.name === objectName);
	if (foundObject) {
		return foundObject.fields || {};
	}
	return [];
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

/*
// code before cleanup for backup
async function main() {
	try {
		const initialConfig = await getYAML(client);
		const redesignConfig = await getYAML(client_redesign);

		const clientCollections = miscLib.varLookup(initialConfig, `settings.plugins.collections.settings.templates`);
		const clientRedesignCollections = miscLib.varLookup(
			redesignConfig,
			`settings.plugins.collections.settings.templates`
		);

		const mappingResults = mappingSetup.map(({ from, to }) => {
			let fromFields = getObjectFields(clientCollections, from);
			let toFields = getObjectFields(clientRedesignCollections, to);

			// handle fields that use template instead of type
			fromFields = fromFields.map((field) => {
				if (field.template) {
					field.type = field.template;
					delete field.template;
				}
				return field;
			});

			const matchedFields = fromFields
				.map(({ name }) => name)
				.filter((field) => toFields.map(({ name }) => name).includes(field));

			const wrongTypeMatch = matchedFields
				.map((fieldName) => {
					const fromClientField = fromFields.filter(({ name }) => name === fieldName)[0];
					const toClientFields = toFields.filter(({ name }) => name === fieldName)[0];

					return fromClientField.type !== toClientFields.type
						? { fieldName, type: fromClientField.type }
						: null;
				})
				.filter((x) => x);

				
			fromFields = fromFields.map(({ name }) => name);
			toFields = toFields.map(({ name }) => name);

			const fields_to_be_mapped_or_deleted = fromFields.filter((field) => !toFields.includes(field));
			const remaining_redesign_fields = toFields.filter((field) => !matchedFields.includes(field));

			console.log(wrongTypeMatch);
			return { from, to, fields_to_be_mapped_or_deleted, remaining_redesign_fields, wrongTypeMatch };
		});
		console.log(mappingResults);
		return mappingResults;
	} catch (e) {
		console.log(e);
		return e.message;
	}
}



*/
