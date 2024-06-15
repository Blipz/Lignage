class Node {
	static TREE = {};

	constructor(obj) {
		if (obj.id === undefined) {
			throw("Node without an id");
		}
		if (Object.entries(Node.TREE).length > 0 && !obj.spouse && !obj.parent) {
			throw(`Non-root node ${obj.id} without spouse nor parent`);
		}
		this.id = obj.id;
		this.name = obj.name;
		if (obj.text) this.text = obj.text;
		if (obj.class) this.class = obj.class;
		if (obj.url) this.url = obj.url;
		if (obj.image) this.image = obj.image;
		if (obj.parent) {
			this.parents = [Node.get(obj.parent), Node.get(obj.parent).spouses[0]];
			Node.get(obj.parent).children.push(this);
			Node.get(obj.parent).spouses[0].children.push(this);
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
		Node.TREE[this.id] = this;
	}

	static get(id) {
		let ret = Node.TREE[id];
		if (!ret) {
			throw(`Unknown id: ${id}`);
		}
		return ret;
	}

	getDepth() {
		let depth = 0;
		for (let i=0; i<this.children.length; i++) {
			let d = this.children[i].getDepth() + 1;
			if (d > depth) depth = d;
		}
		return depth;
	}

	translate(dx, dy) {
		this.x += dx;
		this.y += dy;
		for (let i=0; i<this.children.length; i++) {
			this.children[i].translate(dx, dy);
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

function Lignage(svg, nodes, options = {image: false}) {
	const height = options.height || (options.image? 160 : 50);
	const width = options.width || 120;
	const parentMargin = options.parentMargin !== undefined ? options.parentMargin : 80;
	const spouseMargin = options.spouseMargin !== undefined ? options.spouseMargin : 30;
	const siblingMargin = options.siblingMargin !== undefined ? options.siblingMargin : 30;
	const cousinMargin = options.cousinMargin !== undefined ? options.cousinMargin : 100;

	svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
	svg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

	for (let i=0; i<nodes.length; i++) {
		new Node(nodes[i]);
	}

	const rootNode = Node.get(options.root || nodes[0].id);
	rootNode.parents = [];
	for (let i=0; i<(options.exclude || []).length; i++) {
		node = Node.get(options.exclude[i]);
		for (let j=0; j<node.parents.length; j++) {
			node.parents[j].children = node.parents[j].children.filter(x => x != node);
		}
		for (let j=0; j<node.spouses.length; j++) {
			node.spouses[j].spouses = node.spouses[j].spouses.filter(x => x != node);
		}
		for (let j=0; j<node.children.length; j++) {
			node.spouses[0].children = node.spouses[0].children.filter(x => x != node.children[j]);
		}
	}

	function drawNodes(node, container, recursive = true) {
		let x = node.x;
		let y = node.y;
		if (node.spouses.length > 0) {
			if (recursive) {
				if (node.spouses.length > 1) x += width + spouseMargin;
			}
			else {
				if (node.spouses[0].spouses.length > 1)
					x = node.spouses[0].x + (node == node.spouses[0].spouses[0] ? 0 : (width + spouseMargin) * 2);
				else
					x = node.spouses[0].x + width + spouseMargin;
				y = node.spouses[0].y;
			}
		}

		let elem = makeElement("g", {id: node.id, transform: `translate(${x} ${y})`});
		if (node.class) elem.classList.add(node.class);
		container.appendChild(elem);

		let rect = makeElement("rect", {
			x: 0,
			y: 0,
			rx: 7,
			ry: 7,
			height: height,
			width: width,
			fill: "white",
			stroke: "black"
		});
		elem.appendChild(rect);
		let fontSize = options.fontSize || 16;
		let text1 = makeElement("text", {
			class: "name",
			x: width / 2,
			y: 20,
			fill: "black",
			"font-size": fontSize,
			"font-weight": "bold",
			"text-anchor": "middle"
		});
		text1.innerHTML = node.name;
		if (node.url) {
			let a = makeElement("a", {href: node.url, target: "_blank"});
			a.appendChild(text1);
			elem.appendChild(a);
		}
		else elem.appendChild(text1);
		let text2 = makeElement("text", {
			class: "text",
			x: width / 2,
			y: height - 10,
			fill: "black",
			"font-size": 14,
			"text-anchor": "middle"
		});
		text2.innerHTML = node.text || "";
		elem.appendChild(text2);
		if (options.image) {
			let image = makeElement("image", {
				preserveAspectRatio: "xMidYMid slice",
				"clip-path": "url(#clipImage)",
				href: node.image,
				x: 10,
				y: 30,
				width: 100,
				height: 100
			});
			elem.appendChild(image);
		}
		while (text1.getBBox().width > width) {
			text1.setAttribute("font-size", fontSize--);
		}

		if (recursive) {
			for (let i=0; i<node.spouses.length; i++) {
				drawNodes(node.spouses[i], container, false);
			}
			for (let i=0; i<node.children.length; i++) {
				drawNodes(node.children[i], container);
			}
		}
	}

	function drawLinks(node, container, recursive = true) {
		// Draw links between spouses, and between parents and children
		if (node.spouses.length == 0) return;

		if (recursive) {
			for (let i=0; i<node.spouses.length; i++) {
				drawLinks(node.spouses[i], container, false);
			}
			for (let i=0; i<node.children.length; i++) {
				drawLinks(node.children[i], container);
			}
			return;
		}

		let x = node.spouses[0].x + width + spouseMargin / 2 + (node.spouses[0].spouses[0] != node ? width + spouseMargin : 0);
		let y = node.spouses[0].y + height / 2;
		container.append(makeElement("circle", {cx: x, cy: y, r: 5, fill: "black"}));
		container.append(makeElement("path", {d: `M${x - spouseMargin / 2} ${y} h${spouseMargin}`, stroke: "black"}));

		for (let i=0; i<node.children.length; i++) {
			let dx = node.children[i].x - node.spouses[0].x - (width + spouseMargin) / 2;
			let dy = height / 2 + parentMargin;
			let fraction = 2/3;
			if (node.spouses[0].spouses[0] != node) {
				dx -= width + spouseMargin;
				fraction = 3/4;
			}
			else if (node.spouses[0].spouses.length > 1) {
				fraction = 1/2;
			}
			if (node.children[i].spouses.length > 1) {
				dx += width + spouseMargin;
			}
			let link = makeElement("path", {d: `M${x} ${y} v${dy * fraction} h${dx} v${dy * (1 - fraction)}}`, stroke: "black", fill: "none"});
			container.appendChild(link);
		}
	}

	function computePositions(node, depth = 0) {
		if (depth == maxDepth) {
			node.translate(currentShift, 0);
			if (node.children.length == 0) {
				return null;
			}
			let nodeWidth = width + (width + spouseMargin) * node.spouses.length;
			let delta = 0;
			if (node.spouses.length > 1 && (node.spouses[0].children.length == 0 || node.spouses[1].children.length == 0)) {
				// Double marriage (including one without children)
				nodeWidth -= width + spouseMargin;
				if (node.spouses[0].children.length == 0)
					delta += width + spouseMargin;
			}
			// Align parent in regard to first and last child
			function getChildX(index) {
				return node.children[index].x + (node.children[index].spouses.length > 1 ? width + spouseMargin : 0);
			}
			let diff = (getChildX(0) + getChildX(node.children.length - 1) + width) / 2 - (node.x + delta + nodeWidth / 2);
			if (depth == 0) {
				node.x += diff;
			}
			return node.x + diff;
		}

		if (node.children.length == 0) {
			return;
		}

		if (depth + 1 != maxDepth) {
			for (let i=0; i<node.children.length; i++) {
				computePositions(node.children[i], depth + 1);
			}
			return;
		}

		let positions = [];
		for (let i=0; i<node.children.length; i++) {
			positions.push(computePositions(node.children[i], depth + 1));
		}
		let start = 0;
		let y = (depth + 1) * (height + parentMargin);
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
				widthSum += width + (width + spouseMargin) * node.children[i].spouses.length;
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
				margin = (start == 0 && basePos == 0 || end == positions.length) ? siblingMargin : (positions[end] - widthSum - basePos + siblingMargin) / (end - start + 1);
				if (margin < siblingMargin) {
					if (end < positions.length) {
						collisionShift = (siblingMargin - margin) * (end - start + 1);
					}
					margin = siblingMargin;
				}
				else if (start == 0) {
					margin = siblingMargin;
				}

				if (start == 0 && end < positions.length) {
					let shift = positions[end];
					for (let i=end-1; i>=start; i--) {
						shift -= (width + (width + spouseMargin) * node.children[i].spouses.length) + margin;
						node.children[i].x = shift + collisionShift;
						node.children[i].y = y;
					}
				}
				else {
					for (let i=start; i<end; i++) {
						node.children[i].x = basePos + margin - siblingMargin;
						node.children[i].y = y;
						basePos += (width + (width + spouseMargin) * node.children[i].spouses.length) + margin;
					}
				}
			}

			if (end < positions.length) {
				node.children[end].x = positions[end];
				node.children[end].y = y;
				if (collisionShift) {
					for (let i=end; i<positions.length; i++) {
						node.children[i].translate(collisionShift, 0);
						if (positions[i] !== null) positions[i] += collisionShift;
					}
				}
				basePos = positions[end] + (width + (width + spouseMargin) * node.children[end].spouses.length) + siblingMargin;
			}
			start = end + 1;
			currentShift += collisionShift;
		}
		basePos += cousinMargin - siblingMargin;
	}

	let basePos = 0;
	let currentShift = 0;
	let maxDepth = rootNode.getDepth();
	while (maxDepth >= 0) {
		computePositions(rootNode);
		basePos = 0;
		currentShift = 0;
		maxDepth--;
	}

	let nodeContainer = makeElement("g", {id: "nodes"});
	svg.appendChild(nodeContainer);
	drawNodes(rootNode, nodeContainer);

	let linkContainer = makeElement("g", {id: "links"});
	svg.appendChild(linkContainer);
	drawLinks(rootNode, linkContainer);

	let bbox = nodeContainer.getBBox();
	svg.setAttribute("viewBox", `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
	svg.setAttribute("width", bbox.width);
	svg.setAttribute("height", bbox.height);
}
