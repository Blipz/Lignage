# Lignage

Lignage is a JavaScript tool aimed at generating family trees, with an ancestor as a root.
All descendents of this ancestor, as well as all their spouses, will be displayed.

![Bourbon dynasty](examples/bourbon.png)

## Limitations

- The tree must be an acyclic graph (i.e. no consanguinity)
- The tree must be rooted (i.e. no ancestry for non-descendents)
- Descendents can have at most two spouses

## Usage

```html
<script src="lignage.js"/>

<svg id="lignage"></svg>

<script>
    const nodes = [
        {id: "johnDoe", "name": "John Doe"},
        {id: "janeDoe", "name": "Jane Doe", spouse: "johnDoe"},
        {id: "babyDoe", "name": "Baby Doe", parent: "janeDoe"}
    ];
    const options = {};
    Lignage(document.getElementById("lignage"), nodes, options);
</script>
```

## Data

Each node can have the following properties:

- **id** (mandatory): identifier
- **name**: string that will be displayed
- **spouse**: identifier of the spouse (only for non-descendents)
- **parent**: identifier of the parent (if parent is a descendent, the node will be added outside of marriage)
- **text**: additional string (typically used for birth/death dates)
- **class**: DOM class used for styling
- **url**: link to an external resource
- **image**: link to an external image

Note that the order of nodes matters, as children need to be defined after their parent,
and non-descendent spouses after their spouse.

## Options

The following options can be used:

- **root**: identifier of the root node
- **exclude**: list of identifiers for nodes to be excluded from the tree
- **links**: list of additional links to be drawn, each link being an object with the following attributes:
  - **start** (mandatory): identifier of the start node, or array of identifiers of two spouse nodes
  - **end** (mandatory): identifier of the end node
  - **type**: one of the following values (default: union)
    - descent: for representing a parental link (start bottom -> end top)
    - union: for representing a marriage link (start bottom -> end bottom)
    - closeUnion: for representing a marriage link between adjacent nodes (start right -> end left)
  - **startDx**: horizontal shift at the start of the link (default: 0)
  - **endDx**: horizontal shift at the end of the link (default: 0)
  - **x**: horizontal value to help drawing the link (default: 0.5)
  - **y**: vertical value to help drawing the link (default: 0.5)
  - **replace**: whether or not to omit the automated link joining the end node to the tree (default: false)
  - **class**: DOM class used for styling
- **width**: width of the box representing nodes (default: 120)
- **height**: height of the box representing nodes (default depends on the value of the `images` flag)
- **parentMargin**: vertical spacing between parent and children (default: 80)
- **spouseMargin**: horizontal spacing between spouses (default: 30)
- **siblingMargin**: minimal horizontal spacing between siblings (default: 30)
- **cousinMargin**: minimal horizontal spacing between cousins (default: 100)
- **images**: whether or not to display images (default: false)
- **editable**: whether or not to allow on-the-fly edition (default: false)
- **fontSize**: size of the font used (default: 16)

## Styling

Styling can be performed by appending a `<style>` tag to the SVG element, and by using the corresponding classes with the `class` node/link property.

For instance:

```html
<svg id="lignage">
    <style>
        .royal rect {
            fill: royalblue;
        }
        .royal text {
            fill: white;
        }
    </style>
</svg>
```

## Handling consanguine unions

The following section details some workarounds to handle consanguine unions.
See the [Lagid dynasty](examples/lagids.html) for a concrete use case.

### General case

In the general case, you can assign all the children to one of the spouses, without defining a spouse relationship between them.
Then, manually add a link between the spouses using the `links` option.

Example:

```javascript
const links = [
    {start: "spouse1", end: "spouse2"}
];
```

### Between siblings or cousins

If the spouses are same-level nodes, an alternative way consists of omitting the parent relationship for one of the spouses.
Then, manually add a link between the parentless spouse and the parents, using the `links` option.

Note that this may result in links crossing each other (in the cousin case), or sibling order not being respected (in the case where spouses are non-adjacent siblings).

Example:

```javascript
const links = [
    {start: ["parent1", "parent2"], end: "child", type: "descent"}
];
```
