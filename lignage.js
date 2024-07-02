function Lignage(svg, nodes, options = {}) {
	class BaseNode {
		constructor() {
			this.parents = [];
			this.spouses = [];
			this.children = [];
			this.x = 0;
			this.y = 0;
			this.isRoot = false;
		}

		getChildren() {
			/* Get all the node's children, whereas the children attribute
			 * for a kin node only represents out-of-marriage children */
			if (!this.isKin() || !this.isMarried()) {
				return this.children;
			}

			let children = [];
			if (!this.spouses[0].placeLeft) {
				children = children.concat(this.children);
			}
			for (let spouse of this.spouses) {
				children = children.concat(spouse.children);
			}
			if (this.spouses[0].placeLeft) {
				children = children.concat(this.children);
			}
			return children;
		}

		hasParents() {
			return this.parents.length > 0;
		}

		hasChildren() {
			return this.getChildren().length > 0;
		}

		isMarried() {
			return this.spouses.length > 0;
		}

		isRemarried() {
			return this.spouses.length > 1;
		}

		isKin() {
			return this.isRoot || this.hasParents();
		}

		getDepth() {
			let depth = 0;
			for (let child of this.getChildren()) {
				let d = child.getDepth() + child.levelSkips + 1;
				if (d > depth) depth = d;
			}
			return depth;
		}

		getPosition() {
			/* Compute the position of the node itself, whereas the x and y attributes
			 * describe the position of the group (with spouses) to which the node belongs
			 * and may not be defined for non-kin nodes */
			if (!this.isMarried()) {
				return {x: this.x, y: this.y};
			}
			else if (this.isKin()) {
				let index = 0;
				if (this.isRemarried() || this.spouses[0].placeLeft) {
					index = 1;
				}
				return {x: this.x + (options.width + options.spouseMargin) * index, y: this.y};
			}
			else {
				let index = 1;
				if (this.spouses[0].isRemarried()) {
					if (this.spouses[0].spouses[0] == this) index = 0;
					else index = 2;
				}
				else if (this.placeLeft) {
					index = 0;
				}
				return {x: this.spouses[0].x + (options.width + options.spouseMargin) * index, y: this.spouses[0].y};
			}
		}

		getWidth() {
			/* Compute the width of the node group (only for kin nodes) */
			return options.width + (options.width + options.spouseMargin) * this.spouses.length;
		}

		translate(dx, dy) {
			this.x += dx;
			this.y += dy;
			for (let child of this.getChildren()) {
				child.translate(dx, dy);
			}
		}
	}

	class Node extends BaseNode {
		static TREE = {};

		static get(id) {
			let ret = Node.TREE[id];
			if (!ret) {
				throw Error(`Unknown id '${id}'`);
			}
			return ret;
		}

		constructor(obj) {
			if (obj.id === undefined) {
				throw Error("Node without an id");
			}
			if (Node.TREE[obj.id]) {
				throw Error(`Node '${obj.id}' already exists`);
			}
			if (Object.entries(Node.TREE).length > 0 && !obj.spouse && !obj.parent) {
				throw Error(`Non-root node '${obj.id}' without spouse nor parent`);
			}
			if (obj.spouse && !Node.get(obj.spouse).isKin()) {
				throw Error(`Cannot add spouse to non-kin node '${obj.spouse}'`);
			}
			if (obj.spouse && Node.get(obj.spouse).isRemarried()) {
				throw Error(`Node '${obj.spouse}' cannot have more than two spouses`);
			}
			if (obj.spouse && Node.get(obj.spouse).isMarried() && Node.get(obj.spouse).children.length > 0) {
				throw Error(`Node '${obj.spouse}' cannot have two spouses and out-of-marriage children`);
			}
			if (obj.parent && Node.get(obj.parent).isRemarried()) {
				throw Error(`Node '${obj.parent}' cannot have two spouses and out-of-marriage children`);
			}
			if (obj.spouse && obj.parent) {
				throw Error(`Cannot handle consanguine union between '${obj.id}' and '${obj.spouse}', use the 'links' option instead`);
			}
			super();
			this.id = obj.id;
			this.name = obj.name;
			if (obj.text) this.text = obj.text;
			if (obj.class) this.class = obj.class;
			if (obj.url) this.url = obj.url;
			if (obj.image) this.image = obj.image;
			if (obj.parent) {
				let parent = Node.get(obj.parent);
				if (parent.isKin()) {
					this.parents = [parent];
					if (parent.children.length == 0 && parent.hasChildren()) {
						parent.spouses[0].placeLeft = true;
					}
				}
				else {
					this.parents = [parent, parent.spouses[0]];
				}
				parent.children.push(this);
			}
			if (obj.spouse) {
				this.spouses = [Node.get(obj.spouse)];
				Node.get(obj.spouse).spouses.push(this);
			}
			this.levelSkips = obj.levelSkips || 0;
			this.placeLeft = obj.placeLeft || false;
			this.virtual = obj.virtual || false;
			this.isRoot = (Object.entries(Node.TREE).length == 0);
			Node.TREE[this.id] = this;
		}

		remove(force = false) {
			if (this.isRoot && !force) {
				throw Error(`Cannot remove root node '${this.id}'`);
			}
			for (let parent of this.parents) {
				parent.children = parent.children.filter(x => x != this);
			}
			for (let spouse of this.spouses) {
				if (!this.isKin()) {
					spouse.spouses = spouse.spouses.filter(x => x != this);
				}
				else {
					spouse.remove();
				}
			}
			for (let child of this.children) {
				child.remove();
			}
			options.links = options.links.filter(x => x.start != this.id && x.end != this.id);
			delete Node.TREE[this.id];
		}
	}

	class PseudoNode extends BaseNode {
		constructor(node, level) {
			super();
			if (level <= 0) {
				throw Error("Should not happen");
			}
			else if (level == 1) {
				this.children = [node];
			}
			else {
				this.children = [new PseudoNode(node, level - 1)];
			}
		}
	}

	function makeElement(name, attr = {}, ...children) {
		const ns = "http://www.w3.org/2000/svg";
		const elem = document.createElementNS(ns, name);
		Object.entries(attr).forEach(function([k, v]) {
			elem.setAttribute(k, v);
		});
		elem.append(...children);
		return elem;
	}

	function round(x) {
		return Math.round(x * 10) / 10;
	}

	function initializeOptions() {
		if (options.root === undefined) options.root = nodes[0].id;
		if (options.height === undefined) options.height = options.images? 160 : 50;
		if (options.width === undefined) options.width = 120;
		if (options.parentMargin === undefined) options.parentMargin = 80;
		if (options.spouseMargin === undefined) options.spouseMargin = 30;
		if (options.siblingMargin === undefined) options.siblingMargin = 30;
		if (options.cousinMargin === undefined) options.cousinMargin = 100;
		if (options.fontSize === undefined) options.fontSize = 16;
		if (options.exclude === undefined) options.exclude = [];
		if (options.links === undefined) options.links = [];

		const textRect = makeElement("rect", {x: 0, y: 0, width: options.width, height: options.height, rx: 10, ry: 10});
		defs.replaceChildren(makeElement("clipPath", {id: "clipText"}, textRect));

		if (options.images) {
			const imageRect = makeElement("rect", {x: (options.width - 100) / 2, y: (options.height - 100) / 2, width: 100, height: 100, rx: 10, ry: 10});
			defs.append(makeElement("clipPath", {id: "clipImage"}, imageRect));
		}
		if (options.editable) {
			const icons = {
				"iconAdd": ["limegreen", "M4 0 h2 v4 h4 v2 h-4 v4 h-2 v-4 h-4 v-2 h4z"],
				"iconEdit": ["royalblue", "M0 0 h10 v2 h-10z M0 4 h10 v2 h-10z M0 8 h10 v2 h-10z"],
				"iconJoin": ["purple", "M5 2 a4 4 0 0 0 0 8 4 4 0 0 0 0 -8 m0 1.5 a2.5 2.5 0 0 1 0 5 2.5 2.5 0 0 1 0 -5 M3 0 h4 v2 h-4z"],
				"iconLeft": ["darkgray", "M6.75 0 L1.75 5 L6.75 10 L8.25 8.5 L4.75 5 L8.25 1.5z"],
				"iconRight": ["darkgray", "M3.25 0 L8.25 5 L3.25 10 L1.75 8.5 L5.25 5 L1.75 1.5z"],
				"iconRemove": ["red", "M1.5 0 L5 3.5 L8.5 0 L10 1.5 L6.5 5 L10 8.5 L8.5 10 L5 6.5 L1.5 10 L0 8.5 L3.5 5 L0 1.5z"],
			};
			Object.entries(icons).forEach(function([id, [color, d]]) {
				const icon = makeElement("symbol", {id});
				icon.append(makeElement("rect", {x: 0, y: 0, width: 10, height: 10, rx: 1, ry: 1, fill: color}));
				icon.append(makeElement("path", {d, fill: "white", transform: "translate(2 2) scale(0.6)"}));
				defs.append(icon);
			});
		}
	}

	function redefineRoot() {
		let node = Node.get(options.root);
		if (node != rootNode) {
			for (let parent of node.parents) {
				parent.children = parent.children.filter(x => x != node);
			}
			node.parents = [];
			node.isRoot = true;
			rootNode.remove(true);
		}
		rootNode = node;
	}

	svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
	svg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

	const defs = makeElement("defs");
	svg.append(defs);

	initializeOptions();

	for (let node of nodes) {
		try {
			new Node(node);
		}
		catch(e) {
			console.warn(e.message);
		}
	}

	for (let exclude of options.exclude) {
		try {
			Node.get(exclude).remove();
		}
		catch(e) {
			console.warn(e.message);
		}
	}

	let rootNode = Node.get(nodes[0].id);
	try {
		redefineRoot();
	}
	catch(e) {
		console.warn(e.message);
	}

	function drawTree() {
		function drawNodes(node, container) {
			let {x, y} = node.getPosition();

			let elem = makeElement("g", {id: node.id, class: "node", transform: `translate(${round(x)} ${round(y)})`});
			if (node.class) elem.classList.add(node.class);
			if (!node.virtual) container.append(elem);

			elem.append(makeElement("rect", {
				x: 0,
				y: 0,
				rx: 7,
				ry: 7,
				height: options.height,
				width: options.width,
				fill: "white",
				stroke: "black"
			}));
			let text = makeElement("text", {
				class: "name",
				x: options.width / 2,
				y: 20,
				fill: "black",
				"clip-path": "url(#clipText)",
				"font-size": options.fontSize,
				"font-weight": "bold",
				"text-anchor": "middle",
				cursor: node.url ? "pointer" : "default"
			}, node.name || "");
			elem.append(node.url ? makeElement("a", {href: node.url, target: "_blank"}, text) : text);
			for (let size = options.fontSize; text.getBBox().width > options.width && size > 0; size--) {
				text.setAttribute("font-size", size);
			}
			elem.append(makeElement("text", {
				class: "text",
				x: options.width / 2,
				y: options.height - 10,
				fill: "black",
				"clip-path": "url(#clipText)",
				"font-size": 14,
				"text-anchor": "middle",
				cursor: "default"
			}, node.text || ""));

			if (options.images && node.image) {
				elem.append(makeElement("image", {
					preserveAspectRatio: "xMidYMid slice",
					"clip-path": "url(#clipImage)",
					href: node.image,
					x: (options.width - 100) / 2,
					y: (options.height - 100) / 2,
					width: 100,
					height: 100
				}));
			}

			if (options.editable) {
				let buttons = makeElement("g", {class: "buttons", style: "display: none;"});
				let addButton = makeElement("use", {href: "#iconAdd", transform: `translate(${(options.width - (node.isKin() && !node.isRemarried() ? 0 : 22.5)) / 2} ${options.height - 25}) scale(2.25)`});
				let editButton = makeElement("use", {href: "#iconEdit", transform: `translate(2.5 2.5) scale(2.25)`});
				let joinButton = makeElement("use", {href: "#iconJoin", transform: `translate(${options.width / 2 - 22.5} ${options.height - 25}) scale(2.25)`});
				let leftButton = makeElement("use", {href: "#iconLeft", transform: `translate(2.5 ${options.height - 25}) scale(2.25)`});
				let rightButton = makeElement("use", {href: "#iconRight", transform: `translate(${options.width - 25} ${options.height - 25}) scale(2.25)`});
				let removeButton = makeElement("use", {href: "#iconRemove", transform: `translate(${options.width - 25} 2.5) scale(2.25)`});
				buttons.append(addButton, editButton, joinButton, leftButton, rightButton, removeButton);
				elem.append(buttons);

				function prepareAdd() {
					function generateID(name) {
						// Try a camel-case version of the name provided
						let id = name.replaceAll(/ +(.)/g, (x,y) => y.toUpperCase());
						let index;
						if (id) {
							id = id[0].toLowerCase() + id.slice(1);
							if (!Node.TREE[id]) return id;
							index = 2;
						}
						else {
							id = "node";
							index = 0;
						}
						while (Node.TREE[`${id}${index}`]) {
							index++;
						}
						return `${id}${index}`;
					}
					let input = prompt("Name (Text)");
					if (input === null) return null;

					let match = input.match(/([^(]*)\((.*)\)/);
					if (match) {
						let id = generateID(match[1].trim());
						return {id, name: match[1].trim(), text: match[2].trim()};
					}
					else {
						let id = generateID(input.trim());
						return {id, name: input.trim()};
					}
				}
				addButton.addEventListener("click", function() {
					let obj = prepareAdd();
					if (obj !== null) {
						obj.parent = node.id;
						ret.add(obj);
					}
				});
				editButton.addEventListener("click", function() {
					let input = prompt("Name (Text)", (node.name || "") + (node.text ? ` (${node.text})` : ""));
					if (input !== null) {
						let match = input.match(/([^(]*)\((.*)\)/);
						if (match) {
							node.name = match[1].trim();
							node.text = match[2].trim();
						}
						else {
							node.name = input.trim();
							delete node.text;
						}
						redrawTree();
					}
				});
				joinButton.addEventListener("click", function() {
					let obj = prepareAdd();
					if (obj !== null) {
						obj.spouse = node.id;
						ret.add(obj);
					}
				});
				leftButton.addEventListener("click", function() {
					if (node.hasParents()) {
						let siblings = node.parents[0].children;
						let index = siblings.indexOf(node);
						if (index > 0) {
							siblings[index] = siblings[index - 1];
							siblings[index - 1] = node;
							redrawTree();
						}
					}
					else if (!node.isKin() && !node.placeLeft && !node.spouses[0].isRemarried()) {
						node.placeLeft = true;
						redrawTree();
					}
					else if (!node.isKin() && node.spouses[0].spouses[0] != node) {
						node.spouses[0].spouses.reverse();
						redrawTree();
					}
				});
				rightButton.addEventListener("click", function() {
					if (node.hasParents()) {
						let siblings = node.parents[0].children;
						let index = siblings.indexOf(node);
						if (index < siblings.length - 1) {
							siblings[index] = siblings[index + 1];
							siblings[index + 1] = node;
							redrawTree();
						}
					}
					else if (!node.isKin() && node.placeLeft && !node.spouses[0].isRemarried()) {
						node.placeLeft = false;
						redrawTree();
					}
					else if (!node.isKin() && node.spouses[0].isRemarried() && node.spouses[0].spouses[0] == node) {
						node.spouses[0].spouses.reverse();
						redrawTree();
					}
				});
				removeButton.addEventListener("click", function() {
					ret.remove(node.id);
				});
				elem.addEventListener("mouseover", function() {
					buttons.style.display = "block";
					addButton.style.display = (node.isRemarried() && node.children.length == 0) ? "none" : "block";
					joinButton.style.display = (node.isKin() && !node.isRemarried()) ? "block" : "none";
					leftButton.style.display = (node.hasParents() && node.parents[0].children.indexOf(node) > 0 ||
												(!node.isKin() && !node.placeLeft && !node.spouses[0].isRemarried()) ||
												(!node.isKin() && node.spouses[0].spouses[0] != node)) ? "block" : "none";
					rightButton.style.display = (node.hasParents() && node.parents[0].children.indexOf(node) < node.parents[0].children.length - 1 ||
												(!node.isKin() && node.placeLeft && !node.spouses[0].isRemarried()) ||
												(!node.isKin() && node.spouses[0].isRemarried() && node.spouses[0].spouses[0] == node)) ? "block" : "none";
				});
				elem.addEventListener("mouseout", function() {
					buttons.style.display = "none";
				});
			}

			if (node.isKin()) {
				for (let spouse of node.spouses) {
					drawNodes(spouse, container);
				}
				for (let child of node.getChildren()) {
					drawNodes(child, container);
				}
			}
		}

		function drawLinks(node, container) {
			function computeFraction(n) {
				// Return an appropriate fraction of the vertical spacing between parent and children nodes,
				// so that links won't collide in a situation where half-siblings are involved
				let child1, child2, isLeft;
				if (n.isRemarried() && n.spouses[0].hasChildren() && n.spouses[1].hasChildren()) {
					child1 = n.spouses[0].children.at(-1);
					child2 = n.spouses[1].children[0];
					isLeft = node == n.spouses[0];
				}
				else if (n.isMarried() && n.spouses[0].hasChildren() && n.children.length > 0) {
					child1 = n.spouses[0].placeLeft ? n.spouses[0].children.at(-1) : n.children.at(-1);
					child2 = n.spouses[0].placeLeft ? n.children[0] : n.spouses[0].children[0];
					isLeft = node == n && !n.spouses[0].placeLeft || node != n && n.spouses[0].placeLeft;
				}
				else {
					return 1/2;
				}
				if ((child1.x + child1.getWidth() + child2.x) / 2 > n.x + n.getWidth() / 2) {
					return isLeft ? 2/3 : 1/3;
				}
				else {
					return isLeft ? 1/3 : 2/3;
				}
			}

			if (node.isKin()) {
				if (!node.virtual && node.children.length > 0) {
					// Draw links between a single parent and their children
					let fraction = computeFraction(node);
					let pos1 = node.getPosition();
					let x1 = pos1.x + options.width / 2;
					let y1 = pos1.y + options.height;
					for (let child of node.children) {
						if (child.virtual || linkReplace.includes(child.id)) continue;
						let pos2 = child.getPosition();
						let x2 = pos2.x + options.width / 2;
						let y2 = pos2.y;
						let dy = (y2 - y1) * fraction;
						container.append(makeElement("path", {d: `M${round(x1)} ${round(y1)} v${round(dy)} H${round(x2)} V${round(y2)}`, stroke: "black", fill: "none"}));
					}
				}
				for (let spouse of node.spouses) {
					drawLinks(spouse, container);
				}
				for (let child of node.getChildren()) {
					drawLinks(child, container);
				}
				return;
			}

			if (node.virtual || linkReplace.includes(node.id)) return;

			// Draw a link between spouses
			let pos1 = node.getPosition();
			let pos2 = node.spouses[0].getPosition();
			let x = (pos1.x + pos2.x + options.width) / 2;
			let y = pos1.y + options.height / 2;
			if (!node.spouses[0].virtual) {
				container.append(makeElement("circle", {cx: round(x), cy: round(y), r: 5, fill: "black"}));
				container.append(makeElement("path", {d: `M${round(x - options.spouseMargin / 2)} ${round(y)} h${round(options.spouseMargin)}`, stroke: "black"}));
			}

			// Draw links between parents and children
			let fraction = computeFraction(node.spouses[0]);
			let dy = options.height / 2 + options.parentMargin * fraction;
			for (let child of node.children) {
				if (child.virtual || linkReplace.includes(child.id)) continue;
				let pos3 = child.getPosition();
				container.append(makeElement("path", {d: `M${round(x)} ${round(y)} v${round(dy)} H${round(pos3.x + options.width / 2)} V${round(pos3.y)}`, stroke: "black", fill: "none"}));
			}
		}

		function drawExtraLinks(container) {
			let replacements = [];

			function getCoordinates(id, delta) {
				if (typeof id == "object") {
					let p1 = Node.get(id[0]).getPosition();
					let p2 = Node.get(id[1]).getPosition();
					return [(p1.x + p2.x) / 2, (p1.y + p2.y - options.height) / 2];
				}
				else {
					let pos = Node.get(id).getPosition();
					return [pos.x + (delta || 0), pos.y];
				}
			}

			/* Draw additional links that are not expressed by the tree structure */
			for (link of options.links) {
				let x1, x2, y1, y2;
				try {
					[x1, y1] = getCoordinates(link.start, link.startDx);
					[x2, y2] = getCoordinates(link.end, link.endDx);
				}
				catch(e) {
					console.warn(e.message);
					continue;
				}
				let dx = (x2 - x1) * (link.x === undefined ? 0.5 : link.x);
				let dy = options.parentMargin * (link.y === undefined ? 0.5 : link.y);
				let y3;
				if (link.type == "union" || link.type === undefined) {
					x1 += options.width / 2;
					y1 += options.height;
					x2 += options.width / 2;
					y2 += options.height;
					y3 = y2 + dy;
				}
				else if (link.type == "closeUnion") {
					// This should be used only for same-level nodes that are next to each other
					x1 += options.width;
					y1 += options.height / 2;
					y2 += options.height / 2;
					dx = 0;
					dy = 0;
					y3 = y2;
					container.append(makeElement("circle", {cx: round((x1 + x2) / 2), cy: round((y1 + y2) / 2), r: 5, fill: "black"}));
				}
				else if (link.type == "descent") {
					x1 += options.width / 2;
					y1 += options.height;
					x2 += options.width / 2;
					y3 = y2 - dy;
					if (typeof link.start == "object") dy += options.height / 2;
				}
				else {
					console.warn(`Unknown link type: '${link.type}'`);
					continue;
				}
				let path = makeElement("path", {d: `M${round(x1)} ${round(y1)} v${round(dy)} h${round(dx)} V${round(y3)} H${round(x2)} V${round(y2)}`, stroke: "black", fill: "none"});
				if (link.class) path.classList.add(link.class);
				container.append(path);

				if (link.replace) replacements.push(link.end);
			}

			return replacements;
		}

		function getNodes(node, depth, skips={}) {
			/* Return kin nodes at specified depth, grouped by kin parent node */
			if (depth == 0) {
				return [[node]];
			}
			else if (depth == 1) {
				if (node.levelSkips > 0 && !skips[node.id]) return [[new PseudoNode(node, node.levelSkips)]];
				let children = node.getChildren().map(x => x.levelSkips == 0 || skips[x.id] ? x : new PseudoNode(x, x.levelSkips));
				return children.length > 0 ? [children] : [];
			}
			else {
				let ret = [];
				for (let child of node.getChildren()) {
					if (child.levelSkips > 0 && !skips[child.id]) {
						skips[child.id] = true;
						ret = ret.concat(getNodes(new PseudoNode(child, child.levelSkips), depth - 1, skips));
					}
					else {
						ret = ret.concat(getNodes(child, depth - 1, skips));
					}
				}
				return ret;
			}
		}

		function computePosition(node) {
			// Align parent in regard to first and last child
			if (!node.hasChildren()) {
				return null;
			}
			let children = node.getChildren();
			let nodeWidth = node.getWidth();
			let delta = 0;
			if (node.isRemarried() && (!node.spouses[0].hasChildren() || !node.spouses[1].hasChildren()) ||
				node.isMarried() && !node.spouses[0].hasChildren() && node.children.length > 0) {
				// Ignore the childless spouse for positioning
				nodeWidth -= options.width + options.spouseMargin;
				if (node.isRemarried() && !node.spouses[0].hasChildren() || !node.isRemarried() && node.spouses[0].placeLeft)
					delta = options.width + options.spouseMargin;
			}
			return (children[0].getPosition().x + children.at(-1).getPosition().x + options.width) / 2 - (delta + nodeWidth / 2);
		}

		function adjustPositions(depth) {
			/* Correctly position nodes at specified level, so that
			 * margins are respected but no space is lost */
			let y = depth * (options.height + options.parentMargin);
			let basePos = 0;
			let currentShift = 0;
			let anchored = false;
			let levelNodes = getNodes(rootNode, depth);

			for (let [index, nodes] of levelNodes.entries()) {
				if (currentShift) {
					for (let node of nodes) node.translate(currentShift, 0);
				}
				let positions = nodes.map(computePosition);
				let start = 0;
				while (start < positions.length) {
					let end = start;
					let foundAnchor = false;
					// Iterate until we find the first anchored sibling (relative to their children)
					for (let i=start; i<positions.length; i++) {
						if (positions[i] !== null) {
							end = i;
							foundAnchor = true;
							break;
						}
					}
					if (!foundAnchor) end = positions.length;
					let widthSum = 0;
					for (let i=start; i<end; i++) {
						widthSum += nodes[i].getWidth();
					}
					let collisionShift = 0;

					// Collision check
					let margin = (!anchored || !foundAnchor) ? options.siblingMargin : (positions[end] - widthSum - basePos + options.siblingMargin) / (end - start + 1);
					if (margin < options.siblingMargin) {
						collisionShift = (options.siblingMargin - margin) * (end - start + 1);
						margin = options.siblingMargin;
					}
					else if (start == 0) {
						// Always use siblingMargin, unless between two anchored siblings
						margin = options.siblingMargin;
					}

					if (start == 0 && foundAnchor) {
						let shift = positions[end];
						for (let i=end-1; i>=start; i--) {
							shift -= nodes[i].getWidth() + margin;
							nodes[i].x = shift + collisionShift;
							if (!adjusted[nodes[i].id]) nodes[i].y = y;
							adjusted[nodes[i].id] = true;
						}
					}
					else {
						basePos += margin - options.siblingMargin;
						for (let i=start; i<end; i++) {
							nodes[i].x = basePos;
							if (!adjusted[nodes[i].id]) nodes[i].y = y;
							adjusted[nodes[i].id] = true;
							basePos += nodes[i].getWidth() + margin;
						}
					}

					if (foundAnchor) {
						nodes[end].x = positions[end];
						if (!adjusted[nodes[end].id]) nodes[end].y = y;
						adjusted[nodes[end].id] = true;
						if (collisionShift) {
							// Move all next siblings to the right, with their descent
							for (let i=end; i<positions.length; i++) {
								nodes[i].translate(collisionShift, 0);
								if (positions[i] !== null) positions[i] += collisionShift;
							}
						}
						if (!anchored) {
							anchored = true;

							if (index > 0) {
								// Reposition previous unanchored cousins to avoid losing space
								let latestCousin = levelNodes[index - 1].at(-1);
								let delta = levelNodes[index][0].x - options.cousinMargin - latestCousin.x - latestCousin.getWidth();
								for (let i=0; i<index; i++) {
									for (let node of levelNodes[i]) {
										node.translate(delta, 0);
									}
								}
							}
						}
						basePos = positions[end] + nodes[end].getWidth() + options.siblingMargin;
					}
					start = end + 1;
					currentShift += collisionShift;
				}
				basePos += options.cousinMargin - options.siblingMargin;
			}
		}

		let adjusted = {};
		for (let depth=rootNode.getDepth(); depth>=0; depth--) {
			adjustPositions(depth);
		}

		let nodeContainer = makeElement("g", {id: "nodes"});
		svg.append(nodeContainer);
		drawNodes(rootNode, nodeContainer);

		let linkContainer = makeElement("g", {id: "links"});
		svg.append(linkContainer);
		let linkReplace = drawExtraLinks(linkContainer);
		drawLinks(rootNode, linkContainer);

		let padding = 5;
		let bbox = svg.getBBox();
		svg.setAttribute("viewBox", `${bbox.x - padding} ${bbox.y - padding} ${bbox.width + 2 * padding} ${bbox.height + 2 * padding}`);
		svg.setAttribute("width", bbox.width + 2 * padding);
		svg.setAttribute("height", bbox.height + 2 * padding);
	}

	function redrawTree() {
		svg.getElementById("nodes").remove();
		svg.getElementById("links").remove();
		drawTree();
	}

	drawTree();

	function serializeTree(node) {
		let obj = {id: node.id};
		let ret = [[obj]];
		for (let k of ["name", "text", "class", "url", "image", "levelSkips", "placeLeft", "virtual"]) {
			if (node[k]) obj[k] = node[k];
		}
		if (node.hasParents()) obj.parent = node.parents[0].id;
		if (node.isMarried() && !node.isKin()) obj.spouse = node.spouses[0].id;
		if (node.isKin()) {
			for (let spouse of node.spouses) {
				ret[0] = ret[0].concat(serializeTree(spouse)[0]);
			}
			for (let child of node.getChildren()) {
				for (let [level, serializedNodes] of serializeTree(child).entries()) {
					if (level + 1 < ret.length)
						ret[level + 1] = ret[level + 1].concat(serializedNodes);
					else
						ret[level + 1] = serializedNodes;
				}
			}
		}
		return ret;
	}

	function serializeSVG(callback) {
		let clone = svg.cloneNode(svg);
		for (let button of clone.querySelectorAll(".buttons")) {
			button.remove();
		}
		let svgImages = clone.querySelectorAll(".node > image");
		let remaining = svgImages.length;
		if (remaining == 0) {
			let xml = new XMLSerializer().serializeToString(clone);
			callback("data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml));
		}

		for (let svgImage of svgImages) {
			// Replace each image link by the corresponding base64 data
			let img = new Image();
			img.src = svgImage.getAttribute("href");
			img.onload = function() {
				let canvas = document.createElement("canvas");
				canvas.width = img.width;
				canvas.height = img.height;
				canvas.getContext("2d").drawImage(img, 0, 0);
				try {
					svgImage.setAttribute("href", canvas.toDataURL("png", 1.0));
				}
				catch(e) {
					// Possible CORS-related error
				}
				if (--remaining == 0) {
					let xml = new XMLSerializer().serializeToString(clone);
					callback("data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml));
				}
			};
		}
	}

	let ret = {};
	ret.get = function(id) {
		return Node.get(id);
	};

	ret.add = function(obj) {
		new Node(obj);
		redrawTree();
	};

	ret.remove = function(id) {
		Node.get(id).remove();
		redrawTree();
	};

	ret.getOption = function(name) {
		return options[name];
	};

	ret.setOption = function(name, value) {
		options[name] = value;
		if (name == "root") {
			redefineRoot();
		}
		else {
			initializeOptions();
		}
		redrawTree();
	};

	ret.exportJSON = function() {
		const json = JSON.stringify(serializeTree(rootNode).flat());
		navigator.clipboard.writeText(json);
	};

	ret.downloadPNG = function(filename) {
		const image = new Image();
		image.style.visibility = "hidden";
		document.body.append(image);
		image.onload = function() {
			const canvas = document.createElement("canvas");
			canvas.width = image.clientWidth;
			canvas.height = image.clientHeight;
			canvas.getContext("2d").drawImage(image, 0, 0);
			const a = document.createElement("a");
			a.href = canvas.toDataURL("image/png", 1.0);
			a.download = filename;
			a.click();
			document.body.removeChild(image);
		};
		serializeSVG(function(src) {
			image.src = src;
		});
	};

	ret.downloadSVG = function(filename) {
		serializeSVG(function(src) {
			const a = document.createElement("a");
			a.href = src;
			a.download = filename;
			a.click();
		});
	};

	return ret;
}
