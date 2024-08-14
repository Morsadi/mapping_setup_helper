## Description:
This script is designed to facilitate the mapping of widgets, panels, and collections between initial and redesigned site configurations. It integrates with existing mapping scripts to prepare and align various components from the original site to the new design.

> This script is intended to assist developers by providing a starting point for mapping configurations. Developers will still need to review and tweak the results as necessary to ensure accuracy and completeness. Most of the output is commented out to provide guidance and context for customization.

### Configuration: 
Specify the names of the initial and redesign clients at the beginning.
```
// Update to your client names. These will help target the necessary files.
const initialClient = 'client';
const redesignClient = 'client-redesign';
```
### Mapping Configurations: 
Define what components (collection, panel, widget) should be mapped from the initial site setup to the redesign.
```
const mappingConfigurations = [
    {
        group: 'collection',
        from: 'header_slideshow_interior',
        to: 'core_v2_hero_image',
    },
    {
        group: 'panel',
        from: 'three_col_even',
        to: 'three_col',
    },
    {
        group: 'widget',
        from: 'gdpr_banner',
        to: 'cookie_banner',
    },
];
```
### Result Example
![2024-06-21_12-40-12](https://github.com/user-attachments/assets/47fdb78e-9c92-46f3-917e-1863a2e3b67a)
