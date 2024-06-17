function Lignage(svg, nodes, options = {image: false}) {
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
			}
			for (let spouse of node.spouses) {
				spouse.spouses = spouse.spouses.filter(x => x != node);
			}
			for (let child of node.children) {
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
			if (obj.spouse && Node.get(obj.spouse).spouses.length == 2) {
				throw Error(`Node '${obj.spouse}' cannot have more than two spouses`);
			}
			if (obj.parent && Node.get(obj.parent).isKin()) {
				throw Error(`Cannot add child to kin node '${obj.parent}'`);
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
				this.parents = [parent, parent.spouses[0]];
				parent.children.push(this);
				if (parent == parent.spouses[0].spouses[0] && parent.spouses[0].isRemarried()) {
					parent.spouses[0].children = parent.children.concat(parent.spouses[0].spouses[1].children);
				}
				else {
					parent.spouses[0].children.push(this);
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

		hasChildren() {
			return this.children.length > 0;
		}

		isMarried() {
			return this.spouses.length > 0;
		}

		isRemarried() {
			return this.spouses.length > 1;
		}

		isKin() {
			return this.isRoot || this.parents.length != 0;
		}

		getDepth() {
			let depth = 0;
			for (let child of this.children) {
				let d = child.getDepth() + 1;
				if (d > depth) depth = d;
			}
			return depth;
		}

		translate(dx, dy) {
			this.x += dx;
			this.y += dy;
			for (let child of this.children) {
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

	const height = options.height || (options.image? 160 : 50);
	const width = options.width || 120;
	const parentMargin = options.parentMargin !== undefined ? options.parentMargin : 80;
	const spouseMargin = options.spouseMargin !== undefined ? options.spouseMargin : 30;
	const siblingMargin = options.siblingMargin !== undefined ? options.siblingMargin : 30;
	const cousinMargin = options.cousinMargin !== undefined ? options.cousinMargin : 100;

	svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
	svg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

	for (let node of nodes) {
		new Node(node);
	}

	const rootNode = Node.get(options.root || nodes[0].id);
	rootNode.parents = [];
	for (let exclude of (options.exclude || [])) {
		Node.remove(exclude);
	}

	function drawTree() {
		function drawNodes(node, container, recursive = true) {
			let x = node.x;
			let y = node.y;
			if (node.isMarried()) {
				if (recursive) {
					if (node.isRemarried()) x += width + spouseMargin;
				}
				else {
					if (node.spouses[0].isRemarried())
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
				for (let spouse of node.spouses) {
					drawNodes(spouse, container, false);
				}
				for (let child of node.children) {
					drawNodes(child, container);
				}
			}
		}

		function drawLinks(node, container, recursive = true) {
			// Draw links between spouses, and between parents and children
			if (!node.isMarried()) return;

			if (recursive) {
				for (let spouse of node.spouses) {
					drawLinks(spouse, container, false);
				}
				for (let child of node.children) {
					drawLinks(child, container);
				}
				return;
			}

			let x = node.spouses[0].x + width + spouseMargin / 2 + (node.spouses[0].spouses[0] != node ? width + spouseMargin : 0);
			let y = node.spouses[0].y + height / 2;
			container.append(makeElement("circle", {cx: x, cy: y, r: 5, fill: "black"}));
			container.append(makeElement("path", {d: `M${x - spouseMargin / 2} ${y} h${spouseMargin}`, stroke: "black"}));

			function computeDx(child) {
				let dx = child.x - node.spouses[0].x - (width + spouseMargin) / 2;
				if (node.spouses[0].spouses[0] != child.parents[0]) {
					dx -= width + spouseMargin;
				}
				if (child.isRemarried()) {
					dx += width + spouseMargin;
				}
				return dx;
			}

			for (let child of node.children) {
				let dx = computeDx(child);
				let fraction = 1/2;
				if (node.spouses[0].spouses[0] != node) {
					let firstSpouse = node.spouses[0].spouses[0];
					if (firstSpouse.hasChildren()) {
						fraction = computeDx(node.children[0]) > 0 ? 1/3 : 2/3;
					}
				}
				else if (node.spouses[0].isRemarried()) {
					let secondSpouse = node.spouses[0].spouses[1];
					if (secondSpouse.hasChildren()) {
						fraction = computeDx(secondSpouse.children[0]) > 0 ? 2/3 : 1/3;
					}
				}
				let link = makeElement("path", {d: `M${x} ${y} v${height / 2 + parentMargin * fraction} h${dx} v${parentMargin * (1 - fraction)}`, stroke: "black", fill: "none"});
				container.appendChild(link);
			}
		}

		function getNodes(node, depth) {
			if (depth == 0) {
				return [[node]];
			}
			else if (depth == 1) {
				return node.hasChildren() ? [node.children] : [];
			}
			else {
				let ret = [];
				for (let child of node.children) {
					ret = ret.concat(getNodes(child, depth - 1));
				}
				return ret;
			}
		}

		function computePosition(node) {
			if (!node.hasChildren()) {
				return null;
			}
			let nodeWidth = width + (width + spouseMargin) * node.spouses.length;
			let delta = 0;
			if (node.isRemarried() && (!node.spouses[0].hasChildren() || !node.spouses[1].hasChildren())) {
				// Double marriage (including one without children)
				nodeWidth -= width + spouseMargin;
				if (!node.spouses[0].hasChildren())
					delta = width + spouseMargin;
			}
			// Align parent in regard to first and last child
			function getChildX(index) {
				return node.children[index].x + (node.children[index].isRemarried() ? width + spouseMargin : 0);
			}
			return (getChildX(0) + getChildX(node.children.length - 1) + width) / 2 - (delta + nodeWidth / 2);
		}

		function adjustPositions(depth) {
			let y = (depth + 1) * (height + parentMargin);
			let basePos = 0;
			let currentShift = 0;
			let anchored = false;
			let levelNodes = getNodes(rootNode, depth);
			let index = -1;

			for (let nodes of levelNodes) {
				index++;
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
						widthSum += width + (width + spouseMargin) * nodes[i].spouses.length;
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
								shift -= (width + (width + spouseMargin) * nodes[i].spouses.length) + margin;
								nodes[i].x = shift + collisionShift;
								nodes[i].y = y;
							}
						}
						else {
							for (let i=start; i<end; i++) {
								nodes[i].x = basePos + margin - siblingMargin;
								nodes[i].y = y;
								basePos += (width + (width + spouseMargin) * nodes[i].spouses.length) + margin;
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
							let delta = index == 0 ? null : levelNodes[index][0].x - width - cousinMargin - levelNodes[index - 1][levelNodes[index - 1].length - 1].x;
							for (let i=0; i<index; i++) {
								for (let node of levelNodes[i]) {
									node.translate(delta, 0);
								}
							}

						}
						basePos = positions[end] + (width + (width + spouseMargin) * nodes[end].spouses.length) + siblingMargin;
					}
					start = end + 1;
					currentShift += collisionShift;
				}
				basePos += cousinMargin - siblingMargin;
			}
		}

		for (let depth=rootNode.getDepth(); depth>=0; depth--) {
			adjustPositions(depth);
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

	function redrawTree() {
		document.getElementById("nodes").remove();
		document.getElementById("links").remove();
		drawTree();
	}

	drawTree();

	function serializeTree(node, recursive = true) {
		let obj = {id: node.id};
		let ret = [obj];
		for (let k of ["name", "text", "class", "url", "image"]) {
			if (node[k]) obj[k] = node[k];
		}
		if (node.parents.length > 0) obj.parent = node.parents[0].id;
		if (node.isMarried() && !node.isKin()) obj.spouse = node.spouses[0].id;
		if (recursive) {
			for (let spouse of node.spouses) {
				ret = ret.concat(serializeTree(spouse, false));
			}
			for (let child of node.children) {
				ret = ret.concat(serializeTree(child));
			}
		}
		return ret;
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

	ret.exportJSON = function() {
		const json = JSON.stringify(serializeTree(rootNode));
		navigator.clipboard.writeText(json);
	};

	ret.downloadPNG = function(filename) {
		const xml = new XMLSerializer().serializeToString(svg);
		const image = new Image();
		image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
		image.style.visibility = "hidden";
		document.body.appendChild(image);
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
	};

	ret.downloadSVG = function(filename) {
		const xml = new XMLSerializer().serializeToString(svg);
		const a = document.createElement("a");
		a.href = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
		a.download = filename;
		a.click();
	};

	return ret;
}
