function Lignage(svg, nodes, options = {}) {
	class Node {
		static TREE = {};

		static get(id) {
			let ret = Node.TREE[id];
			if (!ret) {
				throw Error(`Unknown id '${id}'`);
			}
			return ret;
		}

		static remove(id) {
			let node = Node.get(id);
			if (node.isRoot) {
				throw Error(`Cannot remove root node '${id}'`);
			}
			for (let parentNode of node.parents) {
				parentNode.children = parentNode.children.filter(x => x != node);
				if (parentNode.isKin() && parentNode.children.length == 0) {
					parentNode.spouses = parentNode.spouses.filter(x => x != parentNode);
				}
			}
			for (let spouse of node.spouses) {
				spouse.spouses = spouse.spouses.filter(x => x != node);
			}
			for (let child of node.getChildren()) {
				Node.remove(child.id);
			}
			delete Node.TREE[id];
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
			if (obj.parent && Node.get(obj.parent).isRemarried() && !Node.get(obj.parent).spouses.includes(Node.get(obj.parent))) {
				throw Error(`Node '${obj.parent}' cannot have more than two spouses`);
			}
			if (obj.spouse && obj.parent) {
				throw Error(`Cannot handle consanguine union between '${obj.id}' and '${obj.spouse}'`);
			}
			this.id = obj.id;
			this.name = obj.name;
			if (obj.text) this.text = obj.text;
			if (obj.class) this.class = obj.class;
			if (obj.url) this.url = obj.url;
			if (obj.image) this.image = obj.image;
			if (obj.parent) {
				let parent = Node.get(obj.parent);
				parent.children.push(this);
				if (parent.isKin()) {
					this.parents = [parent];
					if (!parent.spouses.includes(parent)) {
						if (parent.hasChildren())
							parent.spouses.push(parent);
						else
							parent.spouses.unshift(parent);
					}
				}
				else {
					this.parents = [parent, parent.spouses[0]];
				}
			}
			else {
				this.parents = [];
			}
			if (obj.spouse) {
				this.spouses = [Node.get(obj.spouse)];
				Node.get(obj.spouse).spouses.push(this);
			}
			else {
				this.spouses = [];
			}
			this.children = [];
			this.x = 0;
			this.y = 0;
			this.isRoot = (Object.entries(Node.TREE).length == 0);
			Node.TREE[this.id] = this;
		}

		getChildren() {
			if (this.isKin()) {
				let children = [];
				if (this.isMarried())
					children = children.concat(this.spouses[0].children);
				if (this.isRemarried())
					children = children.concat(this.spouses[1].children);
				return children;
			}
			else return this.children;
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

		isSecondConsort() {
			return this != this.spouses[0].spouses[0];
		}

		getDepth() {
			let depth = 0;
			for (let child of this.getChildren()) {
				let d = child.getDepth() + 1;
				if (d > depth) depth = d;
			}
			return depth;
		}

		getPosition() {
			if (!this.isMarried()) {
				return {x: this.x, y: this.y};
			}
			else if (this.isKin()) {
				let index = (this.isRemarried() && this.spouses[0] != this) ? 1 : 0;
				return {x: this.x + (options.width + options.spouseMargin) * index, y: this.y};
			}
			else {
				let index = 1;
				if (this.spouses[0].isRemarried()) {
					if (!this.isSecondConsort()) index = 0;
					else if (this.spouses[0].spouses[0] != this.spouses[0]) index = 2;
				}
				return {x: this.spouses[0].x + (options.width + options.spouseMargin) * index, y: this.spouses[0].y};
			}
		}

		getWidth() {
			return options.width + (options.width + options.spouseMargin) * this.spouses.filter(x => x != this).length;
		}

		translate(dx, dy) {
			this.x += dx;
			this.y += dy;
			for (let child of this.getChildren()) {
				child.translate(dx, dy);
			}
		}
	}

	function makeElement(name, attr = {}) {
		const ns = "http://www.w3.org/2000/svg";
		const elem = document.createElementNS(ns, name);
		Object.entries(attr).forEach(function([k, v]) {
			elem.setAttribute(k, v);
		});
		return elem;
	}

	function initializeOptions() {
		if (options.height === undefined) options.height = options.image? 160 : 50;
		if (options.width === undefined) options.width = 120;
		if (options.parentMargin === undefined) options.parentMargin = 80;
		if (options.spouseMargin === undefined) options.spouseMargin = 30;
		if (options.siblingMargin === undefined) options.siblingMargin = 30;
		if (options.cousinMargin === undefined) options.cousinMargin = 100;
		if (options.fontSize === undefined) options.fontSize = 16;
		const rect = makeElement("rect", {x: (options.width - 100) / 2, y: (options.height - 100) / 2, width: 100, height: 100, rx: 10, ry: 10});
		clipImage.replaceChildren(rect);
	}

	svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
	svg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

	const defs = makeElement("defs");
	svg.append(defs);
	const clipImage = makeElement("clipPath", {id: "clipImage"});
	defs.append(clipImage);

	initializeOptions();

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
			let icon = makeElement("symbol", {id});
			icon.append(makeElement("rect", {x: 0, y: 0, width: 10, height: 10, rx: 1, ry: 1, fill: color}));
			icon.append(makeElement("path", {d, fill: "white", transform: "translate(2 2) scale(0.6)"}));
			defs.append(icon);
		});
	}

	for (let node of nodes) {
		new Node(node);
	}

	const rootNode = Node.get(options.root || nodes[0].id);
	rootNode.parents = [];
	for (let exclude of (options.exclude || [])) {
		Node.remove(exclude);
	}

	function drawTree() {
		function drawNodes(node, container) {
			let {x, y} = node.getPosition();

			let elem = makeElement("g", {id: node.id, class: "node", transform: `translate(${x} ${y})`});
			if (node.class) elem.classList.add(node.class);
			container.append(elem);

			let rect = makeElement("rect", {
				x: 0,
				y: 0,
				rx: 7,
				ry: 7,
				height: options.height,
				width: options.width,
				fill: "white",
				stroke: "black"
			});
			elem.append(rect);
			let fontSize = options.fontSize;
			let text1 = makeElement("text", {
				class: "name",
				x: options.width / 2,
				y: 20,
				fill: "black",
				"font-size": fontSize,
				"font-weight": "bold",
				"text-anchor": "middle",
				cursor: node.url ? "pointer" : "default"
			});
			text1.innerHTML = node.name || "";
			if (node.url) {
				let a = makeElement("a", {href: node.url, target: "_blank"});
				a.append(text1);
				elem.append(a);
			}
			else elem.append(text1);
			while (text1.getBBox().width > options.width) {
				text1.setAttribute("font-size", fontSize--);
			}
			let text2 = makeElement("text", {
				class: "text",
				x: options.width / 2,
				y: options.height - 10,
				fill: "black",
				"font-size": 14,
				"text-anchor": "middle",
				cursor: "default"
			});
			text2.innerHTML = node.text || "";
			elem.append(text2);
			if (options.image && node.image) {
				let image = makeElement("image", {
					preserveAspectRatio: "xMidYMid slice",
					"clip-path": "url(#clipImage)",
					href: node.image,
					x: (options.width - 100) / 2,
					y: (options.height - 100) / 2,
					width: 100,
					height: 100
				});
				elem.append(image);
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
					else if (!node.isKin() && node.isSecondConsort()) {
						node.spouses[0].spouses = [node, node.spouses[0].spouses[0]];
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
					else if (!node.isKin() && node.spouses[0].isRemarried() && !node.isSecondConsort()) {
						node.spouses[0].spouses = [node.spouses[0].spouses[1], node];
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
					leftButton.style.display = (node.hasParents() && node.parents[0].children.indexOf(node) > 0 || !node.isKin() && node.isSecondConsort()) ? "block" : "none";
					rightButton.style.display = (node.hasParents() && node.parents[0].children.indexOf(node) < node.parents[0].children.length - 1 ||
												!node.isKin() && node.spouses[0].isRemarried() && !node.isSecondConsort()) ? "block" : "none";
				});
				elem.addEventListener("mouseout", function() {
					buttons.style.display = "none";
				});
			}

			if (node.isKin()) {
				for (let spouse of node.spouses) {
					if (spouse != node) drawNodes(spouse, container);
				}
				for (let child of node.getChildren()) {
					drawNodes(child, container);
				}
			}
		}

		function drawLinks(node, container) {
			function computeFraction(n) {
				if (n.isRemarried() && n.spouses[0].hasChildren() && n.spouses[1].hasChildren()) {
					let child1 = n.spouses[0].children.at(-1);
					let child2 = n.spouses[1].children[0];
					if ((child1.x + child1.getWidth() + child2.x) / 2 > n.x + n.getWidth() / 2) {
						return node == n.spouses[1] ? 1/3 : 2/3;
					}
					else {
						return node == n.spouses[1] ? 2/3 : 1/3;
					}
				}
				return 1/2;
			}

			// Draw links between spouses, and between parents and children
			if (node.isKin()) {
				if (node.children.length > 0) {
					let fraction = computeFraction(node);
					let pos1 = node.getPosition();
					let x1 = pos1.x + options.width / 2;
					let y1 = pos1.y + options.height;
					for (let child of node.children) {
						let pos2 = child.getPosition();
						let x2 = pos2.x + options.width / 2;
						let y2 = pos2.y;
						let dy = (y2 - y1) * fraction;
						let link = makeElement("path", {d: `M${x1} ${y1} v${dy} H${x2} V${y2}`, stroke: "black", fill: "none"});
						container.append(link);
					}
				}
				for (let spouse of node.spouses) {
					if (spouse != node) drawLinks(spouse, container);
				}
				for (let child of node.getChildren()) {
					drawLinks(child, container);
				}
				return;
			}

			let pos1 = node.getPosition();
			let pos2 = node.spouses[0].getPosition();
			let x = (pos1.x + pos2.x + options.width) / 2;
			let y = pos1.y + options.height / 2;
			container.append(makeElement("circle", {cx: x, cy: y, r: 5, fill: "black"}));
			container.append(makeElement("path", {d: `M${x - options.spouseMargin / 2} ${y} h${options.spouseMargin}`, stroke: "black"}));

			let fraction = computeFraction(node.spouses[0]);
			let dy = options.height / 2 + options.parentMargin * fraction;
			for (let child of node.children) {
				let pos3 = child.getPosition();
				let link = makeElement("path", {d: `M${x} ${y} v${dy} H${pos3.x + options.width / 2} V${pos3.y}`, stroke: "black", fill: "none"});
				container.append(link);
			}
		}

		function getNodes(node, depth) {
			if (depth == 0) {
				return [[node]];
			}
			else if (depth == 1) {
				return node.hasChildren() ? [node.getChildren()] : [];
			}
			else {
				let ret = [];
				for (let child of node.getChildren()) {
					ret = ret.concat(getNodes(child, depth - 1));
				}
				return ret;
			}
		}

		function computePosition(node) {
			if (!node.hasChildren()) {
				return null;
			}
			let children = node.getChildren();
			let nodeWidth = node.getWidth();
			let delta = 0;
			if (node.isRemarried() && (!node.spouses[0].hasChildren() || !node.spouses[1].hasChildren())) {
				// Double marriage (including one without children)
				nodeWidth -= options.width + options.spouseMargin;
				if (!node.spouses[0].hasChildren())
					delta = options.width + options.spouseMargin;
			}
			// Align parent in regard to first and last child
			function getChildX(index) {
				return children[index].x + (children[index].isRemarried() ? options.width + options.spouseMargin : 0);
			}
			return (getChildX(0) + getChildX(children.length - 1) + options.width) / 2 - (delta + nodeWidth / 2);
		}

		function adjustPositions(depth) {
			let y = depth * (options.height + options.parentMargin);
			let basePos = 0;
			let currentShift = 0;
			let anchored = false;
			let levelNodes = getNodes(rootNode, depth);

			for (let [index, nodes] of levelNodes.entries()) {
				for (let node of nodes) {
					if (currentShift) node.translate(currentShift, 0);
				}
				let positions = nodes.map(computePosition);
				let start = 0;
				while (start < positions.length) {
					let end = start;
					let found = false;
					for (let i=start; i<positions.length; i++) {
						if (positions[i] !== null) {
							end = i;
							found = true;
							break;
						}
					}
					if (!found) end = positions.length;
					let widthSum = 0;
					for (let i=start; i<end; i++) {
						widthSum += nodes[i].getWidth();
					}
					let collisionShift = 0;
					let margin;
					// Collision check
					if (start == end) {
						if (positions[end] < basePos) {
							collisionShift = basePos - positions[end];
						}
					}
					else {
						margin = (start == 0 && basePos == 0 || end == positions.length) ? options.siblingMargin : (positions[end] - widthSum - basePos + options.siblingMargin) / (end - start + 1);
						if (margin < options.siblingMargin) {
							if (end < positions.length) {
								collisionShift = (options.siblingMargin - margin) * (end - start + 1);
							}
							margin = options.siblingMargin;
						}
						else if (start == 0) {
							margin = options.siblingMargin;
						}

						if (start == 0 && end < positions.length) {
							let shift = positions[end];
							for (let i=end-1; i>=start; i--) {
								shift -= nodes[i].getWidth() + margin;
								nodes[i].x = shift + collisionShift;
								nodes[i].y = y;
							}
						}
						else {
							for (let i=start; i<end; i++) {
								nodes[i].x = basePos + margin - options.siblingMargin;
								nodes[i].y = y;
								basePos += nodes[i].getWidth() + margin;
							}
						}
					}

					if (end < positions.length) {
						nodes[end].x = positions[end];
						nodes[end].y = y;
						if (collisionShift) {
							for (let i=end; i<positions.length; i++) {
								nodes[i].translate(collisionShift, 0);
								if (positions[i] !== null) positions[i] += collisionShift;
							}
						}
						if (!anchored) {
							anchored = true;
							let delta = index == 0 ? null : levelNodes[index][0].x - options.width - options.cousinMargin - levelNodes[index - 1][levelNodes[index - 1].length - 1].x;
							for (let i=0; i<index; i++) {
								for (let node of levelNodes[i]) {
									node.translate(delta, 0);
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

		for (let depth=rootNode.getDepth(); depth>=0; depth--) {
			adjustPositions(depth);
		}

		let nodeContainer = makeElement("g", {id: "nodes"});
		svg.append(nodeContainer);
		drawNodes(rootNode, nodeContainer);

		let linkContainer = makeElement("g", {id: "links"});
		svg.append(linkContainer);
		drawLinks(rootNode, linkContainer);

		let bbox = nodeContainer.getBBox();
		svg.setAttribute("viewBox", `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
		svg.setAttribute("width", bbox.width);
		svg.setAttribute("height", bbox.height);
	}

	function redrawTree() {
		document.getElementById("nodes").remove();
		document.getElementById("links").remove();
		drawTree();
	}

	drawTree();

	function serializeTree(node) {
		let obj = {id: node.id};
		let ret = [[obj]];
		for (let k of ["name", "text", "class", "url", "image"]) {
			if (node[k]) obj[k] = node[k];
		}
		if (node.hasParents()) obj.parent = node.parents[0].id;
		if (node.isMarried() && !node.isKin()) obj.spouse = node.spouses[0].id;
		if (node.isKin()) {
			for (let spouse of node.spouses) {
				if (spouse != node)
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
		Node.remove(id);
		redrawTree();
	};

	ret.getOption = function(name) {
		return options[name];
	}

	ret.setOption = function(name, value) {
		options[name] = value;
		initializeOptions();
		redrawTree();
	}

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
