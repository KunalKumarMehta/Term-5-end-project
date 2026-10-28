#!/usr/bin/env node
import { createRequire } from "node:module"; const require = createRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/yaml/dist/nodes/identity.js
var require_identity = __commonJS({
  "node_modules/yaml/dist/nodes/identity.js"(exports) {
    "use strict";
    var ALIAS = /* @__PURE__ */ Symbol.for("yaml.alias");
    var DOC = /* @__PURE__ */ Symbol.for("yaml.document");
    var MAP = /* @__PURE__ */ Symbol.for("yaml.map");
    var PAIR = /* @__PURE__ */ Symbol.for("yaml.pair");
    var SCALAR2 = /* @__PURE__ */ Symbol.for("yaml.scalar");
    var SEQ = /* @__PURE__ */ Symbol.for("yaml.seq");
    var NODE_TYPE = /* @__PURE__ */ Symbol.for("yaml.node.type");
    var isAlias3 = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
    var isDocument2 = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
    var isMap3 = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
    var isPair2 = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
    var isScalar4 = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR2;
    var isSeq3 = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
    function isCollection2(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case MAP:
          case SEQ:
            return true;
        }
      return false;
    }
    function isNode(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case ALIAS:
          case MAP:
          case SCALAR2:
          case SEQ:
            return true;
        }
      return false;
    }
    var hasAnchor = (node) => (isScalar4(node) || isCollection2(node)) && !!node.anchor;
    exports.ALIAS = ALIAS;
    exports.DOC = DOC;
    exports.MAP = MAP;
    exports.NODE_TYPE = NODE_TYPE;
    exports.PAIR = PAIR;
    exports.SCALAR = SCALAR2;
    exports.SEQ = SEQ;
    exports.hasAnchor = hasAnchor;
    exports.isAlias = isAlias3;
    exports.isCollection = isCollection2;
    exports.isDocument = isDocument2;
    exports.isMap = isMap3;
    exports.isNode = isNode;
    exports.isPair = isPair2;
    exports.isScalar = isScalar4;
    exports.isSeq = isSeq3;
  }
});

// node_modules/yaml/dist/visit.js
var require_visit = __commonJS({
  "node_modules/yaml/dist/visit.js"(exports) {
    "use strict";
    var identity = require_identity();
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove node");
    function visit(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        visit_(null, node, visitor_, Object.freeze([]));
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    function visit_(key, node, visitor, path) {
      const ctrl = callVisitor(key, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visit_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = visit_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = visit_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = visit_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    async function visitAsync(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        await visitAsync_(null, node, visitor_, Object.freeze([]));
    }
    visitAsync.BREAK = BREAK;
    visitAsync.SKIP = SKIP;
    visitAsync.REMOVE = REMOVE;
    async function visitAsync_(key, node, visitor, path) {
      const ctrl = await callVisitor(key, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visitAsync_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = await visitAsync_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = await visitAsync_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = await visitAsync_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    function initVisitor(visitor) {
      if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
        return Object.assign({
          Alias: visitor.Node,
          Map: visitor.Node,
          Scalar: visitor.Node,
          Seq: visitor.Node
        }, visitor.Value && {
          Map: visitor.Value,
          Scalar: visitor.Value,
          Seq: visitor.Value
        }, visitor.Collection && {
          Map: visitor.Collection,
          Seq: visitor.Collection
        }, visitor);
      }
      return visitor;
    }
    function callVisitor(key, node, visitor, path) {
      if (typeof visitor === "function")
        return visitor(key, node, path);
      if (identity.isMap(node))
        return visitor.Map?.(key, node, path);
      if (identity.isSeq(node))
        return visitor.Seq?.(key, node, path);
      if (identity.isPair(node))
        return visitor.Pair?.(key, node, path);
      if (identity.isScalar(node))
        return visitor.Scalar?.(key, node, path);
      if (identity.isAlias(node))
        return visitor.Alias?.(key, node, path);
      return void 0;
    }
    function replaceNode(key, path, node) {
      const parent = path[path.length - 1];
      if (identity.isCollection(parent)) {
        parent.items[key] = node;
      } else if (identity.isPair(parent)) {
        if (key === "key")
          parent.key = node;
        else
          parent.value = node;
      } else if (identity.isDocument(parent)) {
        parent.contents = node;
      } else {
        const pt = identity.isAlias(parent) ? "alias" : "scalar";
        throw new Error(`Cannot replace node with ${pt} parent`);
      }
    }
    exports.visit = visit;
    exports.visitAsync = visitAsync;
  }
});

// node_modules/yaml/dist/doc/directives.js
var require_directives = __commonJS({
  "node_modules/yaml/dist/doc/directives.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    var escapeChars = {
      "!": "%21",
      ",": "%2C",
      "[": "%5B",
      "]": "%5D",
      "{": "%7B",
      "}": "%7D"
    };
    var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
    var Directives = class _Directives {
      constructor(yaml, tags) {
        this.docStart = null;
        this.docEnd = false;
        this.yaml = Object.assign({}, _Directives.defaultYaml, yaml);
        this.tags = Object.assign({}, _Directives.defaultTags, tags);
      }
      clone() {
        const copy = new _Directives(this.yaml, this.tags);
        copy.docStart = this.docStart;
        return copy;
      }
      /**
       * During parsing, get a Directives instance for the current document and
       * update the stream state according to the current version's spec.
       */
      atDocument() {
        const res = new _Directives(this.yaml, this.tags);
        switch (this.yaml.version) {
          case "1.1":
            this.atNextDocument = true;
            break;
          case "1.2":
            this.atNextDocument = false;
            this.yaml = {
              explicit: _Directives.defaultYaml.explicit,
              version: "1.2"
            };
            this.tags = Object.assign({}, _Directives.defaultTags);
            break;
        }
        return res;
      }
      /**
       * @param onError - May be called even if the action was successful
       * @returns `true` on success
       */
      add(line, onError) {
        if (this.atNextDocument) {
          this.yaml = { explicit: _Directives.defaultYaml.explicit, version: "1.1" };
          this.tags = Object.assign({}, _Directives.defaultTags);
          this.atNextDocument = false;
        }
        const parts = line.trim().split(/[ \t]+/);
        const name2 = parts.shift();
        switch (name2) {
          case "%TAG": {
            if (parts.length !== 2) {
              onError(0, "%TAG directive should contain exactly two parts");
              if (parts.length < 2)
                return false;
            }
            const [handle, prefix] = parts;
            this.tags[handle] = prefix;
            return true;
          }
          case "%YAML": {
            this.yaml.explicit = true;
            if (parts.length !== 1) {
              onError(0, "%YAML directive should contain exactly one part");
              return false;
            }
            const [version] = parts;
            if (version === "1.1" || version === "1.2") {
              this.yaml.version = version;
              return true;
            } else {
              const isValid = /^\d+\.\d+$/.test(version);
              onError(6, `Unsupported YAML version ${version}`, isValid);
              return false;
            }
          }
          default:
            onError(0, `Unknown directive ${name2}`, true);
            return false;
        }
      }
      /**
       * Resolves a tag, matching handles to those defined in %TAG directives.
       *
       * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
       *   `'!local'` tag, or `null` if unresolvable.
       */
      tagName(source, onError) {
        if (source === "!")
          return "!";
        if (source[0] !== "!") {
          onError(`Not a valid tag: ${source}`);
          return null;
        }
        if (source[1] === "<") {
          const verbatim = source.slice(2, -1);
          if (verbatim === "!" || verbatim === "!!") {
            onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
            return null;
          }
          if (source[source.length - 1] !== ">")
            onError("Verbatim tags must end with a >");
          return verbatim;
        }
        const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
        if (!suffix)
          onError(`The ${source} tag has no suffix`);
        const prefix = this.tags[handle];
        if (prefix) {
          try {
            return prefix + decodeURIComponent(suffix);
          } catch (error) {
            onError(String(error));
            return null;
          }
        }
        if (handle === "!")
          return source;
        onError(`Could not resolve tag: ${source}`);
        return null;
      }
      /**
       * Given a fully resolved tag, returns its printable string form,
       * taking into account current tag prefixes and defaults.
       */
      tagString(tag) {
        for (const [handle, prefix] of Object.entries(this.tags)) {
          if (tag.startsWith(prefix))
            return handle + escapeTagName(tag.substring(prefix.length));
        }
        return tag[0] === "!" ? tag : `!<${tag}>`;
      }
      toString(doc) {
        const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
        const tagEntries = Object.entries(this.tags);
        let tagNames;
        if (doc && tagEntries.length > 0 && identity.isNode(doc.contents)) {
          const tags = {};
          visit.visit(doc.contents, (_key, node) => {
            if (identity.isNode(node) && node.tag)
              tags[node.tag] = true;
          });
          tagNames = Object.keys(tags);
        } else
          tagNames = [];
        for (const [handle, prefix] of tagEntries) {
          if (handle === "!!" && prefix === "tag:yaml.org,2002:")
            continue;
          if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
            lines.push(`%TAG ${handle} ${prefix}`);
        }
        return lines.join("\n");
      }
    };
    Directives.defaultYaml = { explicit: false, version: "1.2" };
    Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
    exports.Directives = Directives;
  }
});

// node_modules/yaml/dist/doc/anchors.js
var require_anchors = __commonJS({
  "node_modules/yaml/dist/doc/anchors.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    function anchorIsValid(anchor) {
      if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
        const sa = JSON.stringify(anchor);
        const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
        throw new Error(msg);
      }
      return true;
    }
    function anchorNames(root) {
      const anchors = /* @__PURE__ */ new Set();
      visit.visit(root, {
        Value(_key, node) {
          if (node.anchor)
            anchors.add(node.anchor);
        }
      });
      return anchors;
    }
    function findNewAnchor(prefix, exclude) {
      for (let i = 1; true; ++i) {
        const name2 = `${prefix}${i}`;
        if (!exclude.has(name2))
          return name2;
      }
    }
    function createNodeAnchors(doc, prefix) {
      const aliasObjects = [];
      const sourceObjects = /* @__PURE__ */ new Map();
      let prevAnchors = null;
      return {
        onAnchor: (source) => {
          aliasObjects.push(source);
          prevAnchors ?? (prevAnchors = anchorNames(doc));
          const anchor = findNewAnchor(prefix, prevAnchors);
          prevAnchors.add(anchor);
          return anchor;
        },
        /**
         * With circular references, the source node is only resolved after all
         * of its child nodes are. This is why anchors are set only after all of
         * the nodes have been created.
         */
        setAnchors: () => {
          for (const source of aliasObjects) {
            const ref = sourceObjects.get(source);
            if (typeof ref === "object" && ref.anchor && (identity.isScalar(ref.node) || identity.isCollection(ref.node))) {
              ref.node.anchor = ref.anchor;
            } else {
              const error = new Error("Failed to resolve repeated object (this should not happen)");
              error.source = source;
              throw error;
            }
          }
        },
        sourceObjects
      };
    }
    exports.anchorIsValid = anchorIsValid;
    exports.anchorNames = anchorNames;
    exports.createNodeAnchors = createNodeAnchors;
    exports.findNewAnchor = findNewAnchor;
  }
});

// node_modules/yaml/dist/doc/applyReviver.js
var require_applyReviver = __commonJS({
  "node_modules/yaml/dist/doc/applyReviver.js"(exports) {
    "use strict";
    function applyReviver(reviver2, obj, key, val) {
      if (val && typeof val === "object") {
        if (Array.isArray(val)) {
          for (let i = 0, len = val.length; i < len; ++i) {
            const v0 = val[i];
            const v1 = applyReviver(reviver2, val, String(i), v0);
            if (v1 === void 0)
              delete val[i];
            else if (v1 !== v0)
              val[i] = v1;
          }
        } else if (val instanceof Map) {
          for (const k of Array.from(val.keys())) {
            const v0 = val.get(k);
            const v1 = applyReviver(reviver2, val, k, v0);
            if (v1 === void 0)
              val.delete(k);
            else if (v1 !== v0)
              val.set(k, v1);
          }
        } else if (val instanceof Set) {
          for (const v0 of Array.from(val)) {
            const v1 = applyReviver(reviver2, val, v0, v0);
            if (v1 === void 0)
              val.delete(v0);
            else if (v1 !== v0) {
              val.delete(v0);
              val.add(v1);
            }
          }
        } else {
          for (const [k, v0] of Object.entries(val)) {
            const v1 = applyReviver(reviver2, val, k, v0);
            if (v1 === void 0)
              delete val[k];
            else if (v1 !== v0)
              val[k] = v1;
          }
        }
      }
      return reviver2.call(obj, key, val);
    }
    exports.applyReviver = applyReviver;
  }
});

// node_modules/yaml/dist/nodes/toJS.js
var require_toJS = __commonJS({
  "node_modules/yaml/dist/nodes/toJS.js"(exports) {
    "use strict";
    var identity = require_identity();
    function toJS(value, arg, ctx) {
      if (Array.isArray(value))
        return value.map((v, i) => toJS(v, String(i), ctx));
      if (value && typeof value.toJSON === "function") {
        if (!ctx || !identity.hasAnchor(value))
          return value.toJSON(arg, ctx);
        const data = { aliasCount: 0, count: 1, res: void 0 };
        ctx.anchors.set(value, data);
        ctx.onCreate = (res2) => {
          data.res = res2;
          delete ctx.onCreate;
        };
        const res = value.toJSON(arg, ctx);
        if (ctx.onCreate)
          ctx.onCreate(res);
        return res;
      }
      if (typeof value === "bigint" && !ctx?.keep)
        return Number(value);
      return value;
    }
    exports.toJS = toJS;
  }
});

// node_modules/yaml/dist/nodes/Node.js
var require_Node = __commonJS({
  "node_modules/yaml/dist/nodes/Node.js"(exports) {
    "use strict";
    var applyReviver = require_applyReviver();
    var identity = require_identity();
    var toJS = require_toJS();
    var NodeBase = class {
      constructor(type) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: type });
      }
      /** Create a copy of this node.  */
      clone() {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** A plain JavaScript representation of this node. */
      toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver: reviver2 } = {}) {
        if (!identity.isDocument(doc))
          throw new TypeError("A document argument is required");
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc,
          keep: true,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this, "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver2 === "function" ? applyReviver.applyReviver(reviver2, { "": res }, "", res) : res;
      }
    };
    exports.NodeBase = NodeBase;
  }
});

// node_modules/yaml/dist/nodes/Alias.js
var require_Alias = __commonJS({
  "node_modules/yaml/dist/nodes/Alias.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var visit = require_visit();
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var Alias = class extends Node.NodeBase {
      constructor(source) {
        super(identity.ALIAS);
        this.source = source;
        Object.defineProperty(this, "tag", {
          set() {
            throw new Error("Alias nodes cannot have tags");
          }
        });
      }
      /**
       * Resolve the value of this alias within `doc`, finding the last
       * instance of the `source` anchor before this node.
       */
      resolve(doc, ctx) {
        if (ctx?.maxAliasCount === 0)
          throw new ReferenceError("Alias resolution is disabled");
        let nodes;
        if (ctx?.aliasResolveCache) {
          nodes = ctx.aliasResolveCache;
        } else {
          nodes = [];
          visit.visit(doc, {
            Node: (_key, node) => {
              if (identity.isAlias(node) || identity.hasAnchor(node))
                nodes.push(node);
            }
          });
          if (ctx)
            ctx.aliasResolveCache = nodes;
        }
        let found = void 0;
        for (const node of nodes) {
          if (node === this)
            break;
          if (node.anchor === this.source)
            found = node;
        }
        if (found && ctx) {
          const { anchors: anchors2, doc: doc2, maxAliasCount } = ctx;
          let data = anchors2.get(found);
          if (!data) {
            toJS.toJS(found, null, ctx);
            data = anchors2.get(found);
          }
          if (data?.res === void 0) {
            const msg = "This should not happen: Alias anchor was not resolved?";
            throw new ReferenceError(msg);
          }
          if (maxAliasCount >= 0) {
            data.count += 1;
            if (data.aliasCount === 0)
              data.aliasCount = getAliasCount(doc2, found, anchors2);
            if (data.count * data.aliasCount > maxAliasCount) {
              const msg = "Excessive alias count indicates a resource exhaustion attack";
              throw new ReferenceError(msg);
            }
          }
        }
        return found;
      }
      toJSON(_arg, ctx) {
        if (!ctx)
          return { source: this.source };
        const source = this.resolve(ctx.doc, ctx);
        if (!source) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new ReferenceError(msg);
        }
        return ctx.anchors.get(source).res;
      }
      toString(ctx, _onComment, _onChompKeep) {
        const src = `*${this.source}`;
        if (ctx) {
          anchors.anchorIsValid(this.source);
          if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
            const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
            throw new Error(msg);
          }
          if (ctx.implicitKey)
            return `${src} `;
        }
        return src;
      }
    };
    function getAliasCount(doc, node, anchors2) {
      if (identity.isAlias(node)) {
        const source = node.resolve(doc);
        const anchor = anchors2 && source && anchors2.get(source);
        return anchor ? anchor.count * anchor.aliasCount : 0;
      } else if (identity.isCollection(node)) {
        let count = 0;
        for (const item of node.items) {
          const c = getAliasCount(doc, item, anchors2);
          if (c > count)
            count = c;
        }
        return count;
      } else if (identity.isPair(node)) {
        const kc = getAliasCount(doc, node.key, anchors2);
        const vc = getAliasCount(doc, node.value, anchors2);
        return Math.max(kc, vc);
      }
      return 1;
    }
    exports.Alias = Alias;
  }
});

// node_modules/yaml/dist/nodes/Scalar.js
var require_Scalar = __commonJS({
  "node_modules/yaml/dist/nodes/Scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
    var Scalar = class extends Node.NodeBase {
      constructor(value) {
        super(identity.SCALAR);
        this.value = value;
      }
      toJSON(arg, ctx) {
        return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
      }
      toString() {
        return String(this.value);
      }
    };
    Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
    Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
    Scalar.PLAIN = "PLAIN";
    Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
    Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";
    exports.Scalar = Scalar;
    exports.isScalarValue = isScalarValue;
  }
});

// node_modules/yaml/dist/doc/createNode.js
var require_createNode = __commonJS({
  "node_modules/yaml/dist/doc/createNode.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var defaultTagPrefix = "tag:yaml.org,2002:";
    function findTagObject(value, tagName, tags) {
      if (tagName) {
        const match = tags.filter((t) => t.tag === tagName);
        const tagObj = match.find((t) => !t.format) ?? match[0];
        if (!tagObj)
          throw new Error(`Tag ${tagName} not found`);
        return tagObj;
      }
      return tags.find((t) => t.identify?.(value) && !t.format);
    }
    function createNode(value, tagName, ctx) {
      if (identity.isDocument(value))
        value = value.contents;
      if (identity.isNode(value))
        return value;
      if (identity.isPair(value)) {
        const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
        map.items.push(value);
        return map;
      }
      if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
        value = value.valueOf();
      }
      const { aliasDuplicateObjects, onAnchor, onTagObj, schema: schema2, sourceObjects } = ctx;
      let ref = void 0;
      if (aliasDuplicateObjects && value && typeof value === "object") {
        ref = sourceObjects.get(value);
        if (ref) {
          ref.anchor ?? (ref.anchor = onAnchor(value));
          return new Alias.Alias(ref.anchor);
        } else {
          ref = { anchor: null, node: null };
          sourceObjects.set(value, ref);
        }
      }
      if (tagName?.startsWith("!!"))
        tagName = defaultTagPrefix + tagName.slice(2);
      let tagObj = findTagObject(value, tagName, schema2.tags);
      if (!tagObj) {
        if (value && typeof value.toJSON === "function") {
          value = value.toJSON();
        }
        if (!value || typeof value !== "object") {
          const node2 = new Scalar.Scalar(value);
          if (ref)
            ref.node = node2;
          return node2;
        }
        tagObj = value instanceof Map ? schema2[identity.MAP] : Symbol.iterator in Object(value) ? schema2[identity.SEQ] : schema2[identity.MAP];
      }
      if (onTagObj) {
        onTagObj(tagObj);
        delete ctx.onTagObj;
      }
      const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar.Scalar(value);
      if (tagName)
        node.tag = tagName;
      else if (!tagObj.default)
        node.tag = tagObj.tag;
      if (ref)
        ref.node = node;
      return node;
    }
    exports.createNode = createNode;
  }
});

// node_modules/yaml/dist/nodes/Collection.js
var require_Collection = __commonJS({
  "node_modules/yaml/dist/nodes/Collection.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var identity = require_identity();
    var Node = require_Node();
    function collectionFromPath(schema2, path, value) {
      let v = value;
      for (let i = path.length - 1; i >= 0; --i) {
        const k = path[i];
        if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
          const a = [];
          a[k] = v;
          v = a;
        } else {
          v = /* @__PURE__ */ new Map([[k, v]]);
        }
      }
      return createNode.createNode(v, void 0, {
        aliasDuplicateObjects: false,
        keepUndefined: false,
        onAnchor: () => {
          throw new Error("This should not happen, please report a bug.");
        },
        schema: schema2,
        sourceObjects: /* @__PURE__ */ new Map()
      });
    }
    var isEmptyPath = (path) => path == null || typeof path === "object" && !!path[Symbol.iterator]().next().done;
    var Collection = class extends Node.NodeBase {
      constructor(type, schema2) {
        super(type);
        Object.defineProperty(this, "schema", {
          value: schema2,
          configurable: true,
          enumerable: false,
          writable: true
        });
      }
      /**
       * Create a copy of this collection.
       *
       * @param schema - If defined, overwrites the original's schema
       */
      clone(schema2) {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (schema2)
          copy.schema = schema2;
        copy.items = copy.items.map((it) => identity.isNode(it) || identity.isPair(it) ? it.clone(schema2) : it);
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /**
       * Adds a value to the collection. For `!!map` and `!!omap` the value must
       * be a Pair instance or a `{ key, value }` object, which may not have a key
       * that already exists in the map.
       */
      addIn(path, value) {
        if (isEmptyPath(path))
          this.add(value);
        else {
          const [key, ...rest] = path;
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.addIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
      /**
       * Removes a value from the collection.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
          return this.delete(key);
        const node = this.get(key, true);
        if (identity.isCollection(node))
          return node.deleteIn(rest);
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        const [key, ...rest] = path;
        const node = this.get(key, true);
        if (rest.length === 0)
          return !keepScalar && identity.isScalar(node) ? node.value : node;
        else
          return identity.isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
      }
      hasAllNullValues(allowScalar) {
        return this.items.every((node) => {
          if (!identity.isPair(node))
            return false;
          const n = node.value;
          return n == null || allowScalar && identity.isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
        });
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       */
      hasIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
          return this.has(key);
        const node = this.get(key, true);
        return identity.isCollection(node) ? node.hasIn(rest) : false;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        const [key, ...rest] = path;
        if (rest.length === 0) {
          this.set(key, value);
        } else {
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.setIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
    };
    exports.Collection = Collection;
    exports.collectionFromPath = collectionFromPath;
    exports.isEmptyPath = isEmptyPath;
  }
});

// node_modules/yaml/dist/stringify/stringifyComment.js
var require_stringifyComment = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyComment.js"(exports) {
    "use strict";
    var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
    function indentComment(comment, indent) {
      if (/^\n+$/.test(comment))
        return comment.substring(1);
      return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
    }
    var lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;
    exports.indentComment = indentComment;
    exports.lineComment = lineComment;
    exports.stringifyComment = stringifyComment;
  }
});

// node_modules/yaml/dist/stringify/foldFlowLines.js
var require_foldFlowLines = __commonJS({
  "node_modules/yaml/dist/stringify/foldFlowLines.js"(exports) {
    "use strict";
    var FOLD_FLOW = "flow";
    var FOLD_BLOCK = "block";
    var FOLD_QUOTED = "quoted";
    function foldFlowLines(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
      if (!lineWidth || lineWidth < 0)
        return text;
      if (lineWidth < minContentWidth)
        minContentWidth = 0;
      const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
      if (text.length <= endStep)
        return text;
      const folds = [];
      const escapedFolds = {};
      let end = lineWidth - indent.length;
      if (typeof indentAtStart === "number") {
        if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
          folds.push(0);
        else
          end = lineWidth - indentAtStart;
      }
      let split = void 0;
      let prev = void 0;
      let overflow = false;
      let i = -1;
      let escStart = -1;
      let escEnd = -1;
      if (mode === FOLD_BLOCK) {
        i = consumeMoreIndentedLines(text, i, indent.length);
        if (i !== -1)
          end = i + endStep;
      }
      for (let ch; ch = text[i += 1]; ) {
        if (mode === FOLD_QUOTED && ch === "\\") {
          escStart = i;
          switch (text[i + 1]) {
            case "x":
              i += 3;
              break;
            case "u":
              i += 5;
              break;
            case "U":
              i += 9;
              break;
            default:
              i += 1;
          }
          escEnd = i;
        }
        if (ch === "\n") {
          if (mode === FOLD_BLOCK)
            i = consumeMoreIndentedLines(text, i, indent.length);
          end = i + indent.length + endStep;
          split = void 0;
        } else {
          if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
            const next = text[i + 1];
            if (next && next !== " " && next !== "\n" && next !== "	")
              split = i;
          }
          if (i >= end) {
            if (split) {
              folds.push(split);
              end = split + endStep;
              split = void 0;
            } else if (mode === FOLD_QUOTED) {
              while (prev === " " || prev === "	") {
                prev = ch;
                ch = text[i += 1];
                overflow = true;
              }
              const j = i > escEnd + 1 ? i - 2 : escStart - 1;
              if (escapedFolds[j])
                return text;
              folds.push(j);
              escapedFolds[j] = true;
              end = j + endStep;
              split = void 0;
            } else {
              overflow = true;
            }
          }
        }
        prev = ch;
      }
      if (overflow && onOverflow)
        onOverflow();
      if (folds.length === 0)
        return text;
      if (onFold)
        onFold();
      let res = text.slice(0, folds[0]);
      for (let i2 = 0; i2 < folds.length; ++i2) {
        const fold = folds[i2];
        const end2 = folds[i2 + 1] || text.length;
        if (fold === 0)
          res = `
${indent}${text.slice(0, end2)}`;
        else {
          if (mode === FOLD_QUOTED && escapedFolds[fold])
            res += `${text[fold]}\\`;
          res += `
${indent}${text.slice(fold + 1, end2)}`;
        }
      }
      return res;
    }
    function consumeMoreIndentedLines(text, i, indent) {
      let end = i;
      let start = i + 1;
      let ch = text[start];
      while (ch === " " || ch === "	") {
        if (i < start + indent) {
          ch = text[++i];
        } else {
          do {
            ch = text[++i];
          } while (ch && ch !== "\n");
          end = i;
          start = i + 1;
          ch = text[start];
        }
      }
      return end;
    }
    exports.FOLD_BLOCK = FOLD_BLOCK;
    exports.FOLD_FLOW = FOLD_FLOW;
    exports.FOLD_QUOTED = FOLD_QUOTED;
    exports.foldFlowLines = foldFlowLines;
  }
});

// node_modules/yaml/dist/stringify/stringifyString.js
var require_stringifyString = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyString.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var foldFlowLines = require_foldFlowLines();
    var getFoldOptions = (ctx, isBlock) => ({
      indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
      lineWidth: ctx.options.lineWidth,
      minContentWidth: ctx.options.minContentWidth
    });
    var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
    function lineLengthOverLimit(str, lineWidth, indentLength) {
      if (!lineWidth || lineWidth < 0)
        return false;
      const limit = lineWidth - indentLength;
      const strLen = str.length;
      if (strLen <= limit)
        return false;
      for (let i = 0, start = 0; i < strLen; ++i) {
        if (str[i] === "\n") {
          if (i - start > limit)
            return true;
          start = i + 1;
          if (strLen - start <= limit)
            return false;
        }
      }
      return true;
    }
    function doubleQuotedString(value, ctx) {
      const json = JSON.stringify(value);
      if (ctx.options.doubleQuotedAsJSON)
        return json;
      const { implicitKey } = ctx;
      const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      let str = "";
      let start = 0;
      for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
        if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
          str += json.slice(start, i) + "\\ ";
          i += 1;
          start = i;
          ch = "\\";
        }
        if (ch === "\\")
          switch (json[i + 1]) {
            case "u":
              {
                str += json.slice(start, i);
                const code = json.substr(i + 2, 4);
                switch (code) {
                  case "0000":
                    str += "\\0";
                    break;
                  case "0007":
                    str += "\\a";
                    break;
                  case "000b":
                    str += "\\v";
                    break;
                  case "001b":
                    str += "\\e";
                    break;
                  case "0085":
                    str += "\\N";
                    break;
                  case "00a0":
                    str += "\\_";
                    break;
                  case "2028":
                    str += "\\L";
                    break;
                  case "2029":
                    str += "\\P";
                    break;
                  default:
                    if (code.substr(0, 2) === "00")
                      str += "\\x" + code.substr(2);
                    else
                      str += json.substr(i, 6);
                }
                i += 5;
                start = i + 1;
              }
              break;
            case "n":
              if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
                i += 1;
              } else {
                str += json.slice(start, i) + "\n\n";
                while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
                  str += "\n";
                  i += 2;
                }
                str += indent;
                if (json[i + 2] === " ")
                  str += "\\";
                i += 1;
                start = i + 1;
              }
              break;
            default:
              i += 1;
          }
      }
      str = start ? str + json.slice(start) : json;
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
    }
    function singleQuotedString(value, ctx) {
      if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
        return doubleQuotedString(value, ctx);
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
      return ctx.implicitKey ? res : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function quotedString(value, ctx) {
      const { singleQuote } = ctx.options;
      let qs;
      if (singleQuote === false)
        qs = doubleQuotedString;
      else {
        const hasDouble = value.includes('"');
        const hasSingle = value.includes("'");
        if (hasDouble && !hasSingle)
          qs = singleQuotedString;
        else if (hasSingle && !hasDouble)
          qs = doubleQuotedString;
        else
          qs = singleQuote ? singleQuotedString : doubleQuotedString;
      }
      return qs(value, ctx);
    }
    var blockEndNewlines;
    try {
      blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
    } catch {
      blockEndNewlines = /\n+(?!\n|$)/g;
    }
    function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
      const { blockQuote, commentString, lineWidth } = ctx.options;
      if (!blockQuote || /\n[\t ]+$/.test(value)) {
        return quotedString(value, ctx);
      }
      const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
      const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.Scalar.BLOCK_FOLDED ? false : type === Scalar.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
      if (!value)
        return literal ? "|\n" : ">\n";
      let chomp;
      let endStart;
      for (endStart = value.length; endStart > 0; --endStart) {
        const ch = value[endStart - 1];
        if (ch !== "\n" && ch !== "	" && ch !== " ")
          break;
      }
      let end = value.substring(endStart);
      const endNlPos = end.indexOf("\n");
      if (endNlPos === -1) {
        chomp = "-";
      } else if (value === end || endNlPos !== end.length - 1) {
        chomp = "+";
        if (onChompKeep)
          onChompKeep();
      } else {
        chomp = "";
      }
      if (end) {
        value = value.slice(0, -end.length);
        if (end[end.length - 1] === "\n")
          end = end.slice(0, -1);
        end = end.replace(blockEndNewlines, `$&${indent}`);
      }
      let startWithSpace = false;
      let startEnd;
      let startNlPos = -1;
      for (startEnd = 0; startEnd < value.length; ++startEnd) {
        const ch = value[startEnd];
        if (ch === " ")
          startWithSpace = true;
        else if (ch === "\n")
          startNlPos = startEnd;
        else
          break;
      }
      let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
      if (start) {
        value = value.substring(start.length);
        start = start.replace(/\n+/g, `$&${indent}`);
      }
      const indentSize = indent ? "2" : "1";
      let header = (startWithSpace ? indentSize : "") + chomp;
      if (comment) {
        header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
        if (onComment)
          onComment();
      }
      if (!literal) {
        const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
        let literalFallback = false;
        const foldOptions = getFoldOptions(ctx, true);
        if (blockQuote !== "folded" && type !== Scalar.Scalar.BLOCK_FOLDED) {
          foldOptions.onOverflow = () => {
            literalFallback = true;
          };
        }
        const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
        if (!literalFallback)
          return `>${header}
${indent}${body}`;
      }
      value = value.replace(/\n+/g, `$&${indent}`);
      return `|${header}
${indent}${start}${value}${end}`;
    }
    function plainString(item, ctx, onComment, onChompKeep) {
      const { type, value } = item;
      const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
      if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
        return quotedString(value, ctx);
      }
      if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
        return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
      }
      if (!implicitKey && !inFlow && type !== Scalar.Scalar.PLAIN && value.includes("\n")) {
        return blockString(item, ctx, onComment, onChompKeep);
      }
      if (containsDocumentMarker(value)) {
        if (indent === "") {
          ctx.forceBlockIndent = true;
          return blockString(item, ctx, onComment, onChompKeep);
        } else if (implicitKey && indent === indentStep) {
          return quotedString(value, ctx);
        }
      }
      const str = value.replace(/\n+/g, `$&
${indent}`);
      if (actualString) {
        const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
        const { compat, tags } = ctx.doc.schema;
        if (tags.some(test) || compat?.some(test))
          return quotedString(value, ctx);
      }
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function stringifyString(item, ctx, onComment, onChompKeep) {
      const { implicitKey, inFlow } = ctx;
      const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
      let { type } = item;
      if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
        if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
          type = Scalar.Scalar.QUOTE_DOUBLE;
      }
      const _stringify = (_type) => {
        switch (_type) {
          case Scalar.Scalar.BLOCK_FOLDED:
          case Scalar.Scalar.BLOCK_LITERAL:
            return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
          case Scalar.Scalar.QUOTE_DOUBLE:
            return doubleQuotedString(ss.value, ctx);
          case Scalar.Scalar.QUOTE_SINGLE:
            return singleQuotedString(ss.value, ctx);
          case Scalar.Scalar.PLAIN:
            return plainString(ss, ctx, onComment, onChompKeep);
          default:
            return null;
        }
      };
      let res = _stringify(type);
      if (res === null) {
        const { defaultKeyType, defaultStringType } = ctx.options;
        const t = implicitKey && defaultKeyType || defaultStringType;
        res = _stringify(t);
        if (res === null)
          throw new Error(`Unsupported default string type ${t}`);
      }
      return res;
    }
    exports.stringifyString = stringifyString;
  }
});

// node_modules/yaml/dist/stringify/stringify.js
var require_stringify = __commonJS({
  "node_modules/yaml/dist/stringify/stringify.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var identity = require_identity();
    var stringifyComment = require_stringifyComment();
    var stringifyString = require_stringifyString();
    function createStringifyContext(doc, options) {
      const opt = Object.assign({
        blockQuote: true,
        commentString: stringifyComment.stringifyComment,
        defaultKeyType: null,
        defaultStringType: "PLAIN",
        directives: null,
        doubleQuotedAsJSON: false,
        doubleQuotedMinMultiLineLength: 40,
        falseStr: "false",
        flowCollectionPadding: true,
        indentSeq: true,
        lineWidth: 80,
        minContentWidth: 20,
        nullStr: "null",
        simpleKeys: false,
        singleQuote: null,
        trailingComma: false,
        trueStr: "true",
        verifyAliasOrder: true
      }, doc.schema.toStringOptions, options);
      let inFlow;
      switch (opt.collectionStyle) {
        case "block":
          inFlow = false;
          break;
        case "flow":
          inFlow = true;
          break;
        default:
          inFlow = null;
      }
      return {
        anchors: /* @__PURE__ */ new Set(),
        doc,
        flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
        indent: "",
        indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
        inFlow,
        options: opt
      };
    }
    function getTagObject(tags, item) {
      if (item.tag) {
        const match = tags.filter((t) => t.tag === item.tag);
        if (match.length > 0)
          return match.find((t) => t.format === item.format) ?? match[0];
      }
      let tagObj = void 0;
      let obj;
      if (identity.isScalar(item)) {
        obj = item.value;
        let match = tags.filter((t) => t.identify?.(obj));
        if (match.length > 1) {
          const testMatch = match.filter((t) => t.test);
          if (testMatch.length > 0)
            match = testMatch;
        }
        tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
      } else {
        obj = item;
        tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
      }
      if (!tagObj) {
        const name2 = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
        throw new Error(`Tag not resolved for ${name2} value`);
      }
      return tagObj;
    }
    function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
      if (!doc.directives)
        return "";
      const props = [];
      const anchor = (identity.isScalar(node) || identity.isCollection(node)) && node.anchor;
      if (anchor && anchors.anchorIsValid(anchor)) {
        anchors$1.add(anchor);
        props.push(`&${anchor}`);
      }
      const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
      if (tag)
        props.push(doc.directives.tagString(tag));
      return props.join(" ");
    }
    function stringify(item, ctx, onComment, onChompKeep) {
      if (identity.isPair(item))
        return item.toString(ctx, onComment, onChompKeep);
      if (identity.isAlias(item)) {
        if (ctx.doc.directives)
          return item.toString(ctx);
        if (ctx.resolvedAliases?.has(item)) {
          throw new TypeError(`Cannot stringify circular structure without alias nodes`);
        } else {
          if (ctx.resolvedAliases)
            ctx.resolvedAliases.add(item);
          else
            ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
          item = item.resolve(ctx.doc);
        }
      }
      let tagObj = void 0;
      const node = identity.isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
      tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
      const props = stringifyProps(node, tagObj, ctx);
      if (props.length > 0)
        ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
      const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : identity.isScalar(node) ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
      if (!props)
        return str;
      return identity.isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
    }
    exports.createStringifyContext = createStringifyContext;
    exports.stringify = stringify;
  }
});

// node_modules/yaml/dist/stringify/stringifyPair.js
var require_stringifyPair = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyPair.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
      const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
      let keyComment = identity.isNode(key) && key.comment || null;
      if (simpleKeys) {
        if (keyComment) {
          throw new Error("With simple keys, key nodes cannot have comments");
        }
        if (identity.isCollection(key) || !identity.isNode(key) && typeof key === "object") {
          const msg = "With simple keys, collection cannot be used as a key value";
          throw new Error(msg);
        }
      }
      let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || identity.isCollection(key) || (identity.isScalar(key) ? key.type === Scalar.Scalar.BLOCK_FOLDED || key.type === Scalar.Scalar.BLOCK_LITERAL : typeof key === "object"));
      ctx = Object.assign({}, ctx, {
        allNullValues: false,
        implicitKey: !explicitKey && (simpleKeys || !allNullValues),
        indent: indent + indentStep
      });
      let keyCommentDone = false;
      let chompKeep = false;
      let str = stringify.stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
      if (!explicitKey && !ctx.inFlow && str.length > 1024) {
        if (simpleKeys)
          throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
        explicitKey = true;
      }
      if (ctx.inFlow) {
        if (allNullValues || value == null) {
          if (keyCommentDone && onComment)
            onComment();
          return str === "" ? "?" : explicitKey ? `? ${str}` : str;
        }
      } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
        str = `? ${str}`;
        if (keyComment && !keyCommentDone) {
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        } else if (chompKeep && onChompKeep)
          onChompKeep();
        return str;
      }
      if (keyCommentDone)
        keyComment = null;
      if (explicitKey) {
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        str = `? ${str}
${indent}:`;
      } else {
        str = `${str}:`;
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
      }
      let vsb, vcb, valueComment;
      if (identity.isNode(value)) {
        vsb = !!value.spaceBefore;
        vcb = value.commentBefore;
        valueComment = value.comment;
      } else {
        vsb = false;
        vcb = null;
        valueComment = null;
        if (value && typeof value === "object")
          value = doc.createNode(value);
      }
      ctx.implicitKey = false;
      if (!explicitKey && !keyComment && identity.isScalar(value))
        ctx.indentAtStart = str.length + 1;
      chompKeep = false;
      if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && identity.isSeq(value) && !value.flow && !value.tag && !value.anchor) {
        ctx.indent = ctx.indent.substring(2);
      }
      let valueCommentDone = false;
      const valueStr = stringify.stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
      let ws = " ";
      if (keyComment || vsb || vcb) {
        ws = vsb ? "\n" : "";
        if (vcb) {
          const cs = commentString(vcb);
          ws += `
${stringifyComment.indentComment(cs, ctx.indent)}`;
        }
        if (valueStr === "" && !ctx.inFlow) {
          if (ws === "\n" && valueComment)
            ws = "\n\n";
        } else {
          ws += `
${ctx.indent}`;
        }
      } else if (!explicitKey && identity.isCollection(value)) {
        const vs0 = valueStr[0];
        const nl0 = valueStr.indexOf("\n");
        const hasNewline = nl0 !== -1;
        const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
        if (hasNewline || !flow) {
          let hasPropsLine = false;
          if (hasNewline && (vs0 === "&" || vs0 === "!")) {
            let sp0 = valueStr.indexOf(" ");
            if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
              sp0 = valueStr.indexOf(" ", sp0 + 1);
            }
            if (sp0 === -1 || nl0 < sp0)
              hasPropsLine = true;
          }
          if (!hasPropsLine)
            ws = `
${ctx.indent}`;
        }
      } else if (valueStr === "" || valueStr[0] === "\n") {
        ws = "";
      }
      str += ws + valueStr;
      if (ctx.inFlow) {
        if (valueCommentDone && onComment)
          onComment();
      } else if (valueComment && !valueCommentDone) {
        str += stringifyComment.lineComment(str, ctx.indent, commentString(valueComment));
      } else if (chompKeep && onChompKeep) {
        onChompKeep();
      }
      return str;
    }
    exports.stringifyPair = stringifyPair;
  }
});

// node_modules/yaml/dist/log.js
var require_log = __commonJS({
  "node_modules/yaml/dist/log.js"(exports) {
    "use strict";
    var node_process = __require("process");
    function debug(logLevel, ...messages) {
      if (logLevel === "debug")
        console.log(...messages);
    }
    function warn(logLevel, warning) {
      if (logLevel === "debug" || logLevel === "warn") {
        if (typeof node_process.emitWarning === "function")
          node_process.emitWarning(warning);
        else
          console.warn(warning);
      }
    }
    exports.debug = debug;
    exports.warn = warn;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/merge.js
var require_merge = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/merge.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var MERGE_KEY = "<<";
    var merge = {
      identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
      default: "key",
      tag: "tag:yaml.org,2002:merge",
      test: /^<<$/,
      resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), {
        addToJSMap: addMergeToJSMap
      }),
      stringify: () => MERGE_KEY
    };
    var isMergeKey = (ctx, key) => (merge.identify(key) || identity.isScalar(key) && (!key.type || key.type === Scalar.Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
    function addMergeToJSMap(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (identity.isSeq(source))
        for (const it of source.items)
          mergeValue(ctx, map, it);
      else if (Array.isArray(source))
        for (const it of source)
          mergeValue(ctx, map, it);
      else
        mergeValue(ctx, map, source);
    }
    function mergeValue(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (!identity.isMap(source))
        throw new Error("Merge sources must be maps or map aliases");
      const srcMap = source.toJSON(null, ctx, Map);
      for (const [key, value2] of srcMap) {
        if (map instanceof Map) {
          if (!map.has(key))
            map.set(key, value2);
        } else if (map instanceof Set) {
          map.add(key);
        } else if (!Object.prototype.hasOwnProperty.call(map, key)) {
          Object.defineProperty(map, key, {
            value: value2,
            writable: true,
            enumerable: true,
            configurable: true
          });
        }
      }
      return map;
    }
    function resolveAliasValue(ctx, value) {
      return ctx && identity.isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
    }
    exports.addMergeToJSMap = addMergeToJSMap;
    exports.isMergeKey = isMergeKey;
    exports.merge = merge;
  }
});

// node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = __commonJS({
  "node_modules/yaml/dist/nodes/addPairToJSMap.js"(exports) {
    "use strict";
    var log = require_log();
    var merge = require_merge();
    var stringify = require_stringify();
    var identity = require_identity();
    var toJS = require_toJS();
    function addPairToJSMap(ctx, map, { key, value }) {
      if (identity.isNode(key) && key.addToJSMap)
        key.addToJSMap(ctx, map, value);
      else if (merge.isMergeKey(ctx, key))
        merge.addMergeToJSMap(ctx, map, value);
      else {
        const jsKey = toJS.toJS(key, "", ctx);
        if (map instanceof Map) {
          map.set(jsKey, toJS.toJS(value, jsKey, ctx));
        } else if (map instanceof Set) {
          map.add(jsKey);
        } else {
          const stringKey = stringifyKey(key, jsKey, ctx);
          const jsValue = toJS.toJS(value, stringKey, ctx);
          if (stringKey in map)
            Object.defineProperty(map, stringKey, {
              value: jsValue,
              writable: true,
              enumerable: true,
              configurable: true
            });
          else
            map[stringKey] = jsValue;
        }
      }
      return map;
    }
    function stringifyKey(key, jsKey, ctx) {
      if (jsKey === null)
        return "";
      if (typeof jsKey !== "object")
        return String(jsKey);
      if (identity.isNode(key) && ctx?.doc) {
        const strCtx = stringify.createStringifyContext(ctx.doc, {});
        strCtx.anchors = /* @__PURE__ */ new Set();
        for (const node of ctx.anchors.keys())
          strCtx.anchors.add(node.anchor);
        strCtx.inFlow = true;
        strCtx.inStringifyKey = true;
        const strKey = key.toString(strCtx);
        if (!ctx.mapKeyWarned) {
          let jsonStr = JSON.stringify(strKey);
          if (jsonStr.length > 40)
            jsonStr = jsonStr.substring(0, 36) + '..."';
          log.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
          ctx.mapKeyWarned = true;
        }
        return strKey;
      }
      return JSON.stringify(jsKey);
    }
    exports.addPairToJSMap = addPairToJSMap;
  }
});

// node_modules/yaml/dist/nodes/Pair.js
var require_Pair = __commonJS({
  "node_modules/yaml/dist/nodes/Pair.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyPair = require_stringifyPair();
    var addPairToJSMap = require_addPairToJSMap();
    var identity = require_identity();
    function createPair(key, value, ctx) {
      const k = createNode.createNode(key, void 0, ctx);
      const v = createNode.createNode(value, void 0, ctx);
      return new Pair(k, v);
    }
    var Pair = class _Pair {
      constructor(key, value = null) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
        this.key = key;
        this.value = value;
      }
      clone(schema2) {
        let { key, value } = this;
        if (identity.isNode(key))
          key = key.clone(schema2);
        if (identity.isNode(value))
          value = value.clone(schema2);
        return new _Pair(key, value);
      }
      toJSON(_, ctx) {
        const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        return addPairToJSMap.addPairToJSMap(ctx, pair, this);
      }
      toString(ctx, onComment, onChompKeep) {
        return ctx?.doc ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
      }
    };
    exports.Pair = Pair;
    exports.createPair = createPair;
  }
});

// node_modules/yaml/dist/stringify/stringifyCollection.js
var require_stringifyCollection = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyCollection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyCollection(collection, ctx, options) {
      const flow = ctx.inFlow ?? collection.flow;
      const stringify2 = flow ? stringifyFlowCollection : stringifyBlockCollection;
      return stringify2(collection, ctx, options);
    }
    function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
      const { indent, options: { commentString } } = ctx;
      const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
      let chompKeep = false;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment2 = null;
        if (identity.isNode(item)) {
          if (!chompKeep && item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
          if (item.comment)
            comment2 = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (!chompKeep && ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
          }
        }
        chompKeep = false;
        let str2 = stringify.stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
        if (comment2)
          str2 += stringifyComment.lineComment(str2, itemIndent, commentString(comment2));
        if (chompKeep && comment2)
          chompKeep = false;
        lines.push(blockItemPrefix + str2);
      }
      let str;
      if (lines.length === 0) {
        str = flowChars.start + flowChars.end;
      } else {
        str = lines[0];
        for (let i = 1; i < lines.length; ++i) {
          const line = lines[i];
          str += line ? `
${indent}${line}` : "\n";
        }
      }
      if (comment) {
        str += "\n" + stringifyComment.indentComment(commentString(comment), indent);
        if (onComment)
          onComment();
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str;
    }
    function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
      const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
      itemIndent += indentStep;
      const itemCtx = Object.assign({}, ctx, {
        indent: itemIndent,
        inFlow: true,
        type: null
      });
      let reqNewline = false;
      let linesAtValue = 0;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment = null;
        if (identity.isNode(item)) {
          if (item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, false);
          if (item.comment)
            comment = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, false);
            if (ik.comment)
              reqNewline = true;
          }
          const iv = identity.isNode(item.value) ? item.value : null;
          if (iv) {
            if (iv.comment)
              comment = iv.comment;
            if (iv.commentBefore)
              reqNewline = true;
          } else if (item.value == null && ik?.comment) {
            comment = ik.comment;
          }
        }
        if (comment)
          reqNewline = true;
        let str = stringify.stringify(item, itemCtx, () => comment = null);
        reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
        if (i < items.length - 1) {
          str += ",";
        } else if (ctx.options.trailingComma) {
          if (ctx.options.lineWidth > 0) {
            reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
          }
          if (reqNewline) {
            str += ",";
          }
        }
        if (comment)
          str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
        lines.push(str);
        linesAtValue = lines.length;
      }
      const { start, end } = flowChars;
      if (lines.length === 0) {
        return start + end;
      } else {
        if (!reqNewline) {
          const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
          reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
        }
        if (reqNewline) {
          let str = start;
          for (const line of lines)
            str += line ? `
${indentStep}${indent}${line}` : "\n";
          return `${str}
${indent}${end}`;
        } else {
          return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
        }
      }
    }
    function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
      if (comment && chompKeep)
        comment = comment.replace(/^\n+/, "");
      if (comment) {
        const ic = stringifyComment.indentComment(commentString(comment), indent);
        lines.push(ic.trimStart());
      }
    }
    exports.stringifyCollection = stringifyCollection;
  }
});

// node_modules/yaml/dist/nodes/YAMLMap.js
var require_YAMLMap = __commonJS({
  "node_modules/yaml/dist/nodes/YAMLMap.js"(exports) {
    "use strict";
    var stringifyCollection = require_stringifyCollection();
    var addPairToJSMap = require_addPairToJSMap();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    function findPair(items, key) {
      const k = identity.isScalar(key) ? key.value : key;
      for (const it of items) {
        if (identity.isPair(it)) {
          if (it.key === key || it.key === k)
            return it;
          if (identity.isScalar(it.key) && it.key.value === k)
            return it;
        }
      }
      return void 0;
    }
    var YAMLMap = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:map";
      }
      constructor(schema2) {
        super(identity.MAP, schema2);
        this.items = [];
      }
      /**
       * A generic collection parsing method that can be extended
       * to other node classes that inherit from YAMLMap
       */
      static from(schema2, obj, ctx) {
        const { keepUndefined, replacer: replacer2 } = ctx;
        const map = new this(schema2);
        const add = (key, value) => {
          if (typeof replacer2 === "function")
            value = replacer2.call(obj, key, value);
          else if (Array.isArray(replacer2) && !replacer2.includes(key))
            return;
          if (value !== void 0 || keepUndefined)
            map.items.push(Pair.createPair(key, value, ctx));
        };
        if (obj instanceof Map) {
          for (const [key, value] of obj)
            add(key, value);
        } else if (obj && typeof obj === "object") {
          for (const key of Object.keys(obj))
            add(key, obj[key]);
        }
        if (typeof schema2.sortMapEntries === "function") {
          map.items.sort(schema2.sortMapEntries);
        }
        return map;
      }
      /**
       * Adds a value to the collection.
       *
       * @param overwrite - If not set `true`, using a key that is already in the
       *   collection will throw. Otherwise, overwrites the previous value.
       */
      add(pair, overwrite) {
        let _pair;
        if (identity.isPair(pair))
          _pair = pair;
        else if (!pair || typeof pair !== "object" || !("key" in pair)) {
          _pair = new Pair.Pair(pair, pair?.value);
        } else
          _pair = new Pair.Pair(pair.key, pair.value);
        const prev = findPair(this.items, _pair.key);
        const sortEntries = this.schema?.sortMapEntries;
        if (prev) {
          if (!overwrite)
            throw new Error(`Key ${_pair.key} already set`);
          if (identity.isScalar(prev.value) && Scalar.isScalarValue(_pair.value))
            prev.value.value = _pair.value;
          else
            prev.value = _pair.value;
        } else if (sortEntries) {
          const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
          if (i === -1)
            this.items.push(_pair);
          else
            this.items.splice(i, 0, _pair);
        } else {
          this.items.push(_pair);
        }
      }
      delete(key) {
        const it = findPair(this.items, key);
        if (!it)
          return false;
        const del = this.items.splice(this.items.indexOf(it), 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const it = findPair(this.items, key);
        const node = it?.value;
        return (!keepScalar && identity.isScalar(node) ? node.value : node) ?? void 0;
      }
      has(key) {
        return !!findPair(this.items, key);
      }
      set(key, value) {
        this.add(new Pair.Pair(key, value), true);
      }
      /**
       * @param ctx - Conversion context, originally set in Document#toJS()
       * @param {Class} Type - If set, forces the returned collection type
       * @returns Instance of Type, Map, or Object
       */
      toJSON(_, ctx, Type) {
        const map = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const item of this.items)
          addPairToJSMap.addPairToJSMap(ctx, map, item);
        return map;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        for (const item of this.items) {
          if (!identity.isPair(item))
            throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
        }
        if (!ctx.allNullValues && this.hasAllNullValues(false))
          ctx = Object.assign({}, ctx, { allNullValues: true });
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "",
          flowChars: { start: "{", end: "}" },
          itemIndent: ctx.indent || "",
          onChompKeep,
          onComment
        });
      }
    };
    exports.YAMLMap = YAMLMap;
    exports.findPair = findPair;
  }
});

// node_modules/yaml/dist/schema/common/map.js
var require_map = __commonJS({
  "node_modules/yaml/dist/schema/common/map.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLMap = require_YAMLMap();
    var map = {
      collection: "map",
      default: true,
      nodeClass: YAMLMap.YAMLMap,
      tag: "tag:yaml.org,2002:map",
      resolve(map2, onError) {
        if (!identity.isMap(map2))
          onError("Expected a mapping for this tag");
        return map2;
      },
      createNode: (schema2, obj, ctx) => YAMLMap.YAMLMap.from(schema2, obj, ctx)
    };
    exports.map = map;
  }
});

// node_modules/yaml/dist/nodes/YAMLSeq.js
var require_YAMLSeq = __commonJS({
  "node_modules/yaml/dist/nodes/YAMLSeq.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyCollection = require_stringifyCollection();
    var Collection = require_Collection();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var toJS = require_toJS();
    var YAMLSeq = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:seq";
      }
      constructor(schema2) {
        super(identity.SEQ, schema2);
        this.items = [];
      }
      add(value) {
        this.items.push(value);
      }
      /**
       * Removes a value from the collection.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       *
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return false;
        const del = this.items.splice(idx, 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return void 0;
        const it = this.items[idx];
        return !keepScalar && identity.isScalar(it) ? it.value : it;
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       */
      has(key) {
        const idx = asItemIndex(key);
        return typeof idx === "number" && idx < this.items.length;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       *
       * If `key` does not contain a representation of an integer, this will throw.
       * It may be wrapped in a `Scalar`.
       */
      set(key, value) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          throw new Error(`Expected a valid index, not ${key}.`);
        const prev = this.items[idx];
        if (identity.isScalar(prev) && Scalar.isScalarValue(value))
          prev.value = value;
        else
          this.items[idx] = value;
      }
      toJSON(_, ctx) {
        const seq = [];
        if (ctx?.onCreate)
          ctx.onCreate(seq);
        let i = 0;
        for (const item of this.items)
          seq.push(toJS.toJS(item, String(i++), ctx));
        return seq;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "- ",
          flowChars: { start: "[", end: "]" },
          itemIndent: (ctx.indent || "") + "  ",
          onChompKeep,
          onComment
        });
      }
      static from(schema2, obj, ctx) {
        const { replacer: replacer2 } = ctx;
        const seq = new this(schema2);
        if (obj && Symbol.iterator in Object(obj)) {
          let i = 0;
          for (let it of obj) {
            if (typeof replacer2 === "function") {
              const key = obj instanceof Set ? it : String(i++);
              it = replacer2.call(obj, key, it);
            }
            seq.items.push(createNode.createNode(it, void 0, ctx));
          }
        }
        return seq;
      }
    };
    function asItemIndex(key) {
      let idx = identity.isScalar(key) ? key.value : key;
      if (idx && typeof idx === "string")
        idx = Number(idx);
      return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
    }
    exports.YAMLSeq = YAMLSeq;
  }
});

// node_modules/yaml/dist/schema/common/seq.js
var require_seq = __commonJS({
  "node_modules/yaml/dist/schema/common/seq.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLSeq = require_YAMLSeq();
    var seq = {
      collection: "seq",
      default: true,
      nodeClass: YAMLSeq.YAMLSeq,
      tag: "tag:yaml.org,2002:seq",
      resolve(seq2, onError) {
        if (!identity.isSeq(seq2))
          onError("Expected a sequence for this tag");
        return seq2;
      },
      createNode: (schema2, obj, ctx) => YAMLSeq.YAMLSeq.from(schema2, obj, ctx)
    };
    exports.seq = seq;
  }
});

// node_modules/yaml/dist/schema/common/string.js
var require_string = __commonJS({
  "node_modules/yaml/dist/schema/common/string.js"(exports) {
    "use strict";
    var stringifyString = require_stringifyString();
    var string = {
      identify: (value) => typeof value === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str) => str,
      stringify(item, ctx, onComment, onChompKeep) {
        ctx = Object.assign({ actualString: true }, ctx);
        return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
      }
    };
    exports.string = string;
  }
});

// node_modules/yaml/dist/schema/common/null.js
var require_null = __commonJS({
  "node_modules/yaml/dist/schema/common/null.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var nullTag = {
      identify: (value) => value == null,
      createNode: () => new Scalar.Scalar(null),
      default: true,
      tag: "tag:yaml.org,2002:null",
      test: /^(?:~|[Nn]ull|NULL)?$/,
      resolve: () => new Scalar.Scalar(null),
      stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
    };
    exports.nullTag = nullTag;
  }
});

// node_modules/yaml/dist/schema/core/bool.js
var require_bool = __commonJS({
  "node_modules/yaml/dist/schema/core/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var boolTag = {
      identify: (value) => typeof value === "boolean",
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
      resolve: (str) => new Scalar.Scalar(str[0] === "t" || str[0] === "T"),
      stringify({ source, value }, ctx) {
        if (source && boolTag.test.test(source)) {
          const sv = source[0] === "t" || source[0] === "T";
          if (value === sv)
            return source;
        }
        return value ? ctx.options.trueStr : ctx.options.falseStr;
      }
    };
    exports.boolTag = boolTag;
  }
});

// node_modules/yaml/dist/stringify/stringifyNumber.js
var require_stringifyNumber = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyNumber.js"(exports) {
    "use strict";
    function stringifyNumber({ format: format2, minFractionDigits, tag, value }) {
      if (typeof value === "bigint")
        return String(value);
      const num = typeof value === "number" ? value : Number(value);
      if (!isFinite(num))
        return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
      let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
      if (!format2 && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
        let i = n.indexOf(".");
        if (i < 0) {
          i = n.length;
          n += ".";
        }
        let d = minFractionDigits - (n.length - i - 1);
        while (d-- > 0)
          n += "0";
      }
      return n;
    }
    exports.stringifyNumber = stringifyNumber;
  }
});

// node_modules/yaml/dist/schema/core/float.js
var require_float = __commonJS({
  "node_modules/yaml/dist/schema/core/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str));
        const dot = str.indexOf(".");
        if (dot !== -1 && str[str.length - 1] === "0")
          node.minFractionDigits = str.length - dot - 1;
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// node_modules/yaml/dist/schema/core/int.js
var require_int = __commonJS({
  "node_modules/yaml/dist/schema/core/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value) && value >= 0)
        return prefix + value.toString(radix);
      return stringifyNumber.stringifyNumber(node);
    }
    var intOct = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^0o[0-7]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
      stringify: (node) => intStringify(node, 8, "0o")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^0x[0-9a-fA-F]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// node_modules/yaml/dist/schema/core/schema.js
var require_schema = __commonJS({
  "node_modules/yaml/dist/schema/core/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema2 = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.boolTag,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float
    ];
    exports.schema = schema2;
  }
});

// node_modules/yaml/dist/schema/json/schema.js
var require_schema2 = __commonJS({
  "node_modules/yaml/dist/schema/json/schema.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var map = require_map();
    var seq = require_seq();
    function intIdentify(value) {
      return typeof value === "bigint" || Number.isInteger(value);
    }
    var stringifyJSON = ({ value }) => JSON.stringify(value);
    var jsonScalars = [
      {
        identify: (value) => typeof value === "string",
        default: true,
        tag: "tag:yaml.org,2002:str",
        resolve: (str) => str,
        stringify: stringifyJSON
      },
      {
        identify: (value) => value == null,
        createNode: () => new Scalar.Scalar(null),
        default: true,
        tag: "tag:yaml.org,2002:null",
        test: /^null$/,
        resolve: () => null,
        stringify: stringifyJSON
      },
      {
        identify: (value) => typeof value === "boolean",
        default: true,
        tag: "tag:yaml.org,2002:bool",
        test: /^true$|^false$/,
        resolve: (str) => str === "true",
        stringify: stringifyJSON
      },
      {
        identify: intIdentify,
        default: true,
        tag: "tag:yaml.org,2002:int",
        test: /^-?(?:0|[1-9][0-9]*)$/,
        resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
        stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
      },
      {
        identify: (value) => typeof value === "number",
        default: true,
        tag: "tag:yaml.org,2002:float",
        test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
        resolve: (str) => parseFloat(str),
        stringify: stringifyJSON
      }
    ];
    var jsonError = {
      default: true,
      tag: "",
      test: /^/,
      resolve(str, onError) {
        onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
        return str;
      }
    };
    var schema2 = [map.map, seq.seq].concat(jsonScalars, jsonError);
    exports.schema = schema2;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/binary.js
var require_binary = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/binary.js"(exports) {
    "use strict";
    var node_buffer = __require("buffer");
    var Scalar = require_Scalar();
    var stringifyString = require_stringifyString();
    var binary = {
      identify: (value) => value instanceof Uint8Array,
      // Buffer inherits from Uint8Array
      default: false,
      tag: "tag:yaml.org,2002:binary",
      /**
       * Returns a Buffer in node and an Uint8Array in browsers
       *
       * To use the resulting buffer as an image, you'll want to do something like:
       *
       *   const blob = new Blob([buffer], { type: 'image/jpeg' })
       *   document.querySelector('#photo').src = URL.createObjectURL(blob)
       */
      resolve(src, onError) {
        if (typeof node_buffer.Buffer === "function") {
          return node_buffer.Buffer.from(src, "base64");
        } else if (typeof atob === "function") {
          const str = atob(src.replace(/[\n\r]/g, ""));
          const buffer = new Uint8Array(str.length);
          for (let i = 0; i < str.length; ++i)
            buffer[i] = str.charCodeAt(i);
          return buffer;
        } else {
          onError("This environment does not support reading binary tags; either Buffer or atob is required");
          return src;
        }
      },
      stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
        if (!value)
          return "";
        const buf = value;
        let str;
        if (typeof node_buffer.Buffer === "function") {
          str = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
        } else if (typeof btoa === "function") {
          let s = "";
          for (let i = 0; i < buf.length; ++i)
            s += String.fromCharCode(buf[i]);
          str = btoa(s);
        } else {
          throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
        }
        type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
        if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
          const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
          const n = Math.ceil(str.length / lineWidth);
          const lines = new Array(n);
          for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
            lines[i] = str.substr(o, lineWidth);
          }
          str = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? "\n" : " ");
        }
        return stringifyString.stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
      }
    };
    exports.binary = binary;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/pairs.js
var require_pairs = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/pairs.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLSeq = require_YAMLSeq();
    function resolvePairs(seq, onError) {
      if (identity.isSeq(seq)) {
        for (let i = 0; i < seq.items.length; ++i) {
          let item = seq.items[i];
          if (identity.isPair(item))
            continue;
          else if (identity.isMap(item)) {
            if (item.items.length > 1)
              onError("Each pair must have its own sequence indicator");
            const pair = item.items[0] || new Pair.Pair(new Scalar.Scalar(null));
            if (item.commentBefore)
              pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
            if (item.comment) {
              const cn = pair.value ?? pair.key;
              cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
            }
            item = pair;
          }
          seq.items[i] = identity.isPair(item) ? item : new Pair.Pair(item);
        }
      } else
        onError("Expected a sequence for this tag");
      return seq;
    }
    function createPairs(schema2, iterable, ctx) {
      const { replacer: replacer2 } = ctx;
      const pairs2 = new YAMLSeq.YAMLSeq(schema2);
      pairs2.tag = "tag:yaml.org,2002:pairs";
      let i = 0;
      if (iterable && Symbol.iterator in Object(iterable))
        for (let it of iterable) {
          if (typeof replacer2 === "function")
            it = replacer2.call(iterable, String(i++), it);
          let key, value;
          if (Array.isArray(it)) {
            if (it.length === 2) {
              key = it[0];
              value = it[1];
            } else
              throw new TypeError(`Expected [key, value] tuple: ${it}`);
          } else if (it && it instanceof Object) {
            const keys = Object.keys(it);
            if (keys.length === 1) {
              key = keys[0];
              value = it[key];
            } else {
              throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
            }
          } else {
            key = it;
          }
          pairs2.items.push(Pair.createPair(key, value, ctx));
        }
      return pairs2;
    }
    var pairs = {
      collection: "seq",
      default: false,
      tag: "tag:yaml.org,2002:pairs",
      resolve: resolvePairs,
      createNode: createPairs
    };
    exports.createPairs = createPairs;
    exports.pairs = pairs;
    exports.resolvePairs = resolvePairs;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/omap.js
var require_omap = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/omap.js"(exports) {
    "use strict";
    var identity = require_identity();
    var toJS = require_toJS();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var pairs = require_pairs();
    var YAMLOMap = class _YAMLOMap extends YAMLSeq.YAMLSeq {
      constructor() {
        super();
        this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
        this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
        this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
        this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
        this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
        this.tag = _YAMLOMap.tag;
      }
      /**
       * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
       * but TypeScript won't allow widening the signature of a child method.
       */
      toJSON(_, ctx) {
        if (!ctx)
          return super.toJSON(_);
        const map = /* @__PURE__ */ new Map();
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const pair of this.items) {
          let key, value;
          if (identity.isPair(pair)) {
            key = toJS.toJS(pair.key, "", ctx);
            value = toJS.toJS(pair.value, key, ctx);
          } else {
            key = toJS.toJS(pair, "", ctx);
          }
          if (map.has(key))
            throw new Error("Ordered maps must not include duplicate keys");
          map.set(key, value);
        }
        return map;
      }
      static from(schema2, iterable, ctx) {
        const pairs$1 = pairs.createPairs(schema2, iterable, ctx);
        const omap2 = new this();
        omap2.items = pairs$1.items;
        return omap2;
      }
    };
    YAMLOMap.tag = "tag:yaml.org,2002:omap";
    var omap = {
      collection: "seq",
      identify: (value) => value instanceof Map,
      nodeClass: YAMLOMap,
      default: false,
      tag: "tag:yaml.org,2002:omap",
      resolve(seq, onError) {
        const pairs$1 = pairs.resolvePairs(seq, onError);
        const seenKeys = [];
        for (const { key } of pairs$1.items) {
          if (identity.isScalar(key)) {
            if (seenKeys.includes(key.value)) {
              onError(`Ordered maps must not include duplicate keys: ${key.value}`);
            } else {
              seenKeys.push(key.value);
            }
          }
        }
        return Object.assign(new YAMLOMap(), pairs$1);
      },
      createNode: (schema2, iterable, ctx) => YAMLOMap.from(schema2, iterable, ctx)
    };
    exports.YAMLOMap = YAMLOMap;
    exports.omap = omap;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/bool.js
var require_bool2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function boolStringify({ value, source }, ctx) {
      const boolObj = value ? trueTag : falseTag;
      if (source && boolObj.test.test(source))
        return source;
      return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
    var trueTag = {
      identify: (value) => value === true,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
      resolve: () => new Scalar.Scalar(true),
      stringify: boolStringify
    };
    var falseTag = {
      identify: (value) => value === false,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
      resolve: () => new Scalar.Scalar(false),
      stringify: boolStringify
    };
    exports.falseTag = falseTag;
    exports.trueTag = trueTag;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/float.js
var require_float2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str.replace(/_/g, "")),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str.replace(/_/g, "")));
        const dot = str.indexOf(".");
        if (dot !== -1) {
          const f = str.substring(dot + 1).replace(/_/g, "");
          if (f[f.length - 1] === "0")
            node.minFractionDigits = f.length;
        }
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/int.js
var require_int2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    function intResolve(str, offset, radix, { intAsBigInt }) {
      const sign = str[0];
      if (sign === "-" || sign === "+")
        offset += 1;
      str = str.substring(offset).replace(/_/g, "");
      if (intAsBigInt) {
        switch (radix) {
          case 2:
            str = `0b${str}`;
            break;
          case 8:
            str = `0o${str}`;
            break;
          case 16:
            str = `0x${str}`;
            break;
        }
        const n2 = BigInt(str);
        return sign === "-" ? BigInt(-1) * n2 : n2;
      }
      const n = parseInt(str, radix);
      return sign === "-" ? -1 * n : n;
    }
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value)) {
        const str = value.toString(radix);
        return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
      }
      return stringifyNumber.stringifyNumber(node);
    }
    var intBin = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "BIN",
      test: /^[-+]?0b[0-1_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
      stringify: (node) => intStringify(node, 2, "0b")
    };
    var intOct = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^[-+]?0[0-7_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
      stringify: (node) => intStringify(node, 8, "0")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9][0-9_]*$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^[-+]?0x[0-9a-fA-F_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intBin = intBin;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/set.js
var require_set = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/set.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSet = class _YAMLSet extends YAMLMap.YAMLMap {
      constructor(schema2) {
        super(schema2);
        this.tag = _YAMLSet.tag;
      }
      add(key) {
        let pair;
        if (identity.isPair(key))
          pair = key;
        else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
          pair = new Pair.Pair(key.key, null);
        else
          pair = new Pair.Pair(key, null);
        const prev = YAMLMap.findPair(this.items, pair.key);
        if (!prev)
          this.items.push(pair);
      }
      /**
       * If `keepPair` is `true`, returns the Pair matching `key`.
       * Otherwise, returns the value of that Pair's key.
       */
      get(key, keepPair) {
        const pair = YAMLMap.findPair(this.items, key);
        return !keepPair && identity.isPair(pair) ? identity.isScalar(pair.key) ? pair.key.value : pair.key : pair;
      }
      set(key, value) {
        if (typeof value !== "boolean")
          throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
        const prev = YAMLMap.findPair(this.items, key);
        if (prev && !value) {
          this.items.splice(this.items.indexOf(prev), 1);
        } else if (!prev && value) {
          this.items.push(new Pair.Pair(key));
        }
      }
      toJSON(_, ctx) {
        return super.toJSON(_, ctx, Set);
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        if (this.hasAllNullValues(true))
          return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
        else
          throw new Error("Set items must all have null values");
      }
      static from(schema2, iterable, ctx) {
        const { replacer: replacer2 } = ctx;
        const set2 = new this(schema2);
        if (iterable && Symbol.iterator in Object(iterable))
          for (let value of iterable) {
            if (typeof replacer2 === "function")
              value = replacer2.call(iterable, value, value);
            set2.items.push(Pair.createPair(value, null, ctx));
          }
        return set2;
      }
    };
    YAMLSet.tag = "tag:yaml.org,2002:set";
    var set = {
      collection: "map",
      identify: (value) => value instanceof Set,
      nodeClass: YAMLSet,
      default: false,
      tag: "tag:yaml.org,2002:set",
      createNode: (schema2, iterable, ctx) => YAMLSet.from(schema2, iterable, ctx),
      resolve(map, onError) {
        if (identity.isMap(map)) {
          if (map.hasAllNullValues(true))
            return Object.assign(new YAMLSet(), map);
          else
            onError("Set items must all have null values");
        } else
          onError("Expected a mapping for this tag");
        return map;
      }
    };
    exports.YAMLSet = YAMLSet;
    exports.set = set;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/timestamp.js
var require_timestamp = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/timestamp.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    function parseSexagesimal(str, asBigInt) {
      const sign = str[0];
      const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
      const num = (n) => asBigInt ? BigInt(n) : Number(n);
      const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
      return sign === "-" ? num(-1) * res : res;
    }
    function stringifySexagesimal(node) {
      let { value } = node;
      let num = (n) => n;
      if (typeof value === "bigint")
        num = (n) => BigInt(n);
      else if (isNaN(value) || !isFinite(value))
        return stringifyNumber.stringifyNumber(node);
      let sign = "";
      if (value < 0) {
        sign = "-";
        value *= num(-1);
      }
      const _60 = num(60);
      const parts = [value % _60];
      if (value < 60) {
        parts.unshift(0);
      } else {
        value = (value - parts[0]) / _60;
        parts.unshift(value % _60);
        if (value >= 60) {
          value = (value - parts[0]) / _60;
          parts.unshift(value);
        }
      }
      return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
    }
    var intTime = {
      identify: (value) => typeof value === "bigint" || Number.isInteger(value),
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
      resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
      stringify: stringifySexagesimal
    };
    var floatTime = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
      resolve: (str) => parseSexagesimal(str, false),
      stringify: stringifySexagesimal
    };
    var timestamp = {
      identify: (value) => value instanceof Date,
      default: true,
      tag: "tag:yaml.org,2002:timestamp",
      // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
      // may be omitted altogether, resulting in a date format. In such a case, the time part is
      // assumed to be 00:00:00Z (start of day, UTC).
      test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
      resolve(str) {
        const match = str.match(timestamp.test);
        if (!match)
          throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
        const [, year, month, day, hour, minute, second] = match.map(Number);
        const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
        let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
        const tz = match[8];
        if (tz && tz !== "Z") {
          let d = parseSexagesimal(tz, false);
          if (Math.abs(d) < 30)
            d *= 60;
          date -= 6e4 * d;
        }
        return new Date(date);
      },
      stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
    };
    exports.floatTime = floatTime;
    exports.intTime = intTime;
    exports.timestamp = timestamp;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/schema.js
var require_schema3 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var binary = require_binary();
    var bool = require_bool2();
    var float = require_float2();
    var int = require_int2();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var set = require_set();
    var timestamp = require_timestamp();
    var schema2 = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.trueTag,
      bool.falseTag,
      int.intBin,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float,
      binary.binary,
      merge.merge,
      omap.omap,
      pairs.pairs,
      set.set,
      timestamp.intTime,
      timestamp.floatTime,
      timestamp.timestamp
    ];
    exports.schema = schema2;
  }
});

// node_modules/yaml/dist/schema/tags.js
var require_tags = __commonJS({
  "node_modules/yaml/dist/schema/tags.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema2 = require_schema();
    var schema$1 = require_schema2();
    var binary = require_binary();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var schema$2 = require_schema3();
    var set = require_set();
    var timestamp = require_timestamp();
    var schemas = /* @__PURE__ */ new Map([
      ["core", schema2.schema],
      ["failsafe", [map.map, seq.seq, string.string]],
      ["json", schema$1.schema],
      ["yaml11", schema$2.schema],
      ["yaml-1.1", schema$2.schema]
    ]);
    var tagsByName = {
      binary: binary.binary,
      bool: bool.boolTag,
      float: float.float,
      floatExp: float.floatExp,
      floatNaN: float.floatNaN,
      floatTime: timestamp.floatTime,
      int: int.int,
      intHex: int.intHex,
      intOct: int.intOct,
      intTime: timestamp.intTime,
      map: map.map,
      merge: merge.merge,
      null: _null.nullTag,
      omap: omap.omap,
      pairs: pairs.pairs,
      seq: seq.seq,
      set: set.set,
      timestamp: timestamp.timestamp
    };
    var coreKnownTags = {
      "tag:yaml.org,2002:binary": binary.binary,
      "tag:yaml.org,2002:merge": merge.merge,
      "tag:yaml.org,2002:omap": omap.omap,
      "tag:yaml.org,2002:pairs": pairs.pairs,
      "tag:yaml.org,2002:set": set.set,
      "tag:yaml.org,2002:timestamp": timestamp.timestamp
    };
    function getTags(customTags, schemaName, addMergeTag) {
      const schemaTags = schemas.get(schemaName);
      if (schemaTags && !customTags) {
        return addMergeTag && !schemaTags.includes(merge.merge) ? schemaTags.concat(merge.merge) : schemaTags.slice();
      }
      let tags = schemaTags;
      if (!tags) {
        if (Array.isArray(customTags))
          tags = [];
        else {
          const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
        }
      }
      if (Array.isArray(customTags)) {
        for (const tag of customTags)
          tags = tags.concat(tag);
      } else if (typeof customTags === "function") {
        tags = customTags(tags.slice());
      }
      if (addMergeTag)
        tags = tags.concat(merge.merge);
      return tags.reduce((tags2, tag) => {
        const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
        if (!tagObj) {
          const tagName = JSON.stringify(tag);
          const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
        }
        if (!tags2.includes(tagObj))
          tags2.push(tagObj);
        return tags2;
      }, []);
    }
    exports.coreKnownTags = coreKnownTags;
    exports.getTags = getTags;
  }
});

// node_modules/yaml/dist/schema/Schema.js
var require_Schema = __commonJS({
  "node_modules/yaml/dist/schema/Schema.js"(exports) {
    "use strict";
    var identity = require_identity();
    var map = require_map();
    var seq = require_seq();
    var string = require_string();
    var tags = require_tags();
    var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    var Schema = class _Schema {
      constructor({ compat, customTags, merge, resolveKnownTags, schema: schema2, sortMapEntries, toStringDefaults }) {
        this.compat = Array.isArray(compat) ? tags.getTags(compat, "compat") : compat ? tags.getTags(null, compat) : null;
        this.name = typeof schema2 === "string" && schema2 || "core";
        this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
        this.tags = tags.getTags(customTags, this.name, merge);
        this.toStringOptions = toStringDefaults ?? null;
        Object.defineProperty(this, identity.MAP, { value: map.map });
        Object.defineProperty(this, identity.SCALAR, { value: string.string });
        Object.defineProperty(this, identity.SEQ, { value: seq.seq });
        this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
      }
      clone() {
        const copy = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
        copy.tags = this.tags.slice();
        return copy;
      }
    };
    exports.Schema = Schema;
  }
});

// node_modules/yaml/dist/stringify/stringifyDocument.js
var require_stringifyDocument = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyDocument.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyDocument(doc, options) {
      const lines = [];
      let hasDirectives = options.directives === true;
      if (options.directives !== false && doc.directives) {
        const dir = doc.directives.toString(doc);
        if (dir) {
          lines.push(dir);
          hasDirectives = true;
        } else if (doc.directives.docStart)
          hasDirectives = true;
      }
      if (hasDirectives)
        lines.push("---");
      const ctx = stringify.createStringifyContext(doc, options);
      const { commentString } = ctx.options;
      if (doc.commentBefore) {
        if (lines.length !== 1)
          lines.unshift("");
        const cs = commentString(doc.commentBefore);
        lines.unshift(stringifyComment.indentComment(cs, ""));
      }
      let chompKeep = false;
      let contentComment = null;
      if (doc.contents) {
        if (identity.isNode(doc.contents)) {
          if (doc.contents.spaceBefore && hasDirectives)
            lines.push("");
          if (doc.contents.commentBefore) {
            const cs = commentString(doc.contents.commentBefore);
            lines.push(stringifyComment.indentComment(cs, ""));
          }
          ctx.forceBlockIndent = !!doc.comment;
          contentComment = doc.contents.comment;
        }
        const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
        let body = stringify.stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
        if (contentComment)
          body += stringifyComment.lineComment(body, "", commentString(contentComment));
        if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
          lines[lines.length - 1] = `--- ${body}`;
        } else
          lines.push(body);
      } else {
        lines.push(stringify.stringify(doc.contents, ctx));
      }
      if (doc.directives?.docEnd) {
        if (doc.comment) {
          const cs = commentString(doc.comment);
          if (cs.includes("\n")) {
            lines.push("...");
            lines.push(stringifyComment.indentComment(cs, ""));
          } else {
            lines.push(`... ${cs}`);
          }
        } else {
          lines.push("...");
        }
      } else {
        let dc = doc.comment;
        if (dc && chompKeep)
          dc = dc.replace(/^\n+/, "");
        if (dc) {
          if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
            lines.push("");
          lines.push(stringifyComment.indentComment(commentString(dc), ""));
        }
      }
      return lines.join("\n") + "\n";
    }
    exports.stringifyDocument = stringifyDocument;
  }
});

// node_modules/yaml/dist/doc/Document.js
var require_Document = __commonJS({
  "node_modules/yaml/dist/doc/Document.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var toJS = require_toJS();
    var Schema = require_Schema();
    var stringifyDocument = require_stringifyDocument();
    var anchors = require_anchors();
    var applyReviver = require_applyReviver();
    var createNode = require_createNode();
    var directives = require_directives();
    var Document = class _Document {
      constructor(value, replacer2, options) {
        this.commentBefore = null;
        this.comment = null;
        this.errors = [];
        this.warnings = [];
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
        let _replacer = null;
        if (typeof replacer2 === "function" || Array.isArray(replacer2)) {
          _replacer = replacer2;
        } else if (options === void 0 && replacer2) {
          options = replacer2;
          replacer2 = void 0;
        }
        const opt = Object.assign({
          intAsBigInt: false,
          keepSourceTokens: false,
          logLevel: "warn",
          prettyErrors: true,
          strict: true,
          stringKeys: false,
          uniqueKeys: true,
          version: "1.2"
        }, options);
        this.options = opt;
        let { version } = opt;
        if (options?._directives) {
          this.directives = options._directives.atDocument();
          if (this.directives.yaml.explicit)
            version = this.directives.yaml.version;
        } else
          this.directives = new directives.Directives({ version });
        this.setSchema(version, options);
        this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
      }
      /**
       * Create a deep copy of this Document and its contents.
       *
       * Custom Node values that inherit from `Object` still refer to their original instances.
       */
      clone() {
        const copy = Object.create(_Document.prototype, {
          [identity.NODE_TYPE]: { value: identity.DOC }
        });
        copy.commentBefore = this.commentBefore;
        copy.comment = this.comment;
        copy.errors = this.errors.slice();
        copy.warnings = this.warnings.slice();
        copy.options = Object.assign({}, this.options);
        if (this.directives)
          copy.directives = this.directives.clone();
        copy.schema = this.schema.clone();
        copy.contents = identity.isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** Adds a value to the document. */
      add(value) {
        if (assertCollection(this.contents))
          this.contents.add(value);
      }
      /** Adds a value to the document. */
      addIn(path, value) {
        if (assertCollection(this.contents))
          this.contents.addIn(path, value);
      }
      /**
       * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
       *
       * If `node` already has an anchor, `name` is ignored.
       * Otherwise, the `node.anchor` value will be set to `name`,
       * or if an anchor with that name is already present in the document,
       * `name` will be used as a prefix for a new unique anchor.
       * If `name` is undefined, the generated anchor will use 'a' as a prefix.
       */
      createAlias(node, name2) {
        if (!node.anchor) {
          const prev = anchors.anchorNames(this);
          node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          !name2 || prev.has(name2) ? anchors.findNewAnchor(name2 || "a", prev) : name2;
        }
        return new Alias.Alias(node.anchor);
      }
      createNode(value, replacer2, options) {
        let _replacer = void 0;
        if (typeof replacer2 === "function") {
          value = replacer2.call({ "": value }, "", value);
          _replacer = replacer2;
        } else if (Array.isArray(replacer2)) {
          const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
          const asStr = replacer2.filter(keyToStr).map(String);
          if (asStr.length > 0)
            replacer2 = replacer2.concat(asStr);
          _replacer = replacer2;
        } else if (options === void 0 && replacer2) {
          options = replacer2;
          replacer2 = void 0;
        }
        const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
        const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(
          this,
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          anchorPrefix || "a"
        );
        const ctx = {
          aliasDuplicateObjects: aliasDuplicateObjects ?? true,
          keepUndefined: keepUndefined ?? false,
          onAnchor,
          onTagObj,
          replacer: _replacer,
          schema: this.schema,
          sourceObjects
        };
        const node = createNode.createNode(value, tag, ctx);
        if (flow && identity.isCollection(node))
          node.flow = true;
        setAnchors();
        return node;
      }
      /**
       * Convert a key and a value into a `Pair` using the current schema,
       * recursively wrapping all values as `Scalar` or `Collection` nodes.
       */
      createPair(key, value, options = {}) {
        const k = this.createNode(key, null, options);
        const v = this.createNode(value, null, options);
        return new Pair.Pair(k, v);
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        return assertCollection(this.contents) ? this.contents.delete(key) : false;
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        if (Collection.isEmptyPath(path)) {
          if (this.contents == null)
            return false;
          this.contents = null;
          return true;
        }
        return assertCollection(this.contents) ? this.contents.deleteIn(path) : false;
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      get(key, keepScalar) {
        return identity.isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
      }
      /**
       * Returns item at `path`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        if (Collection.isEmptyPath(path))
          return !keepScalar && identity.isScalar(this.contents) ? this.contents.value : this.contents;
        return identity.isCollection(this.contents) ? this.contents.getIn(path, keepScalar) : void 0;
      }
      /**
       * Checks if the document includes a value with the key `key`.
       */
      has(key) {
        return identity.isCollection(this.contents) ? this.contents.has(key) : false;
      }
      /**
       * Checks if the document includes a value at `path`.
       */
      hasIn(path) {
        if (Collection.isEmptyPath(path))
          return this.contents !== void 0;
        return identity.isCollection(this.contents) ? this.contents.hasIn(path) : false;
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      set(key, value) {
        if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, [key], value);
        } else if (assertCollection(this.contents)) {
          this.contents.set(key, value);
        }
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        if (Collection.isEmptyPath(path)) {
          this.contents = value;
        } else if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, Array.from(path), value);
        } else if (assertCollection(this.contents)) {
          this.contents.setIn(path, value);
        }
      }
      /**
       * Change the YAML version and schema used by the document.
       * A `null` version disables support for directives, explicit tags, anchors, and aliases.
       * It also requires the `schema` option to be given as a `Schema` instance value.
       *
       * Overrides all previously set schema options.
       */
      setSchema(version, options = {}) {
        if (typeof version === "number")
          version = String(version);
        let opt;
        switch (version) {
          case "1.1":
            if (this.directives)
              this.directives.yaml.version = "1.1";
            else
              this.directives = new directives.Directives({ version: "1.1" });
            opt = { resolveKnownTags: false, schema: "yaml-1.1" };
            break;
          case "1.2":
          case "next":
            if (this.directives)
              this.directives.yaml.version = version;
            else
              this.directives = new directives.Directives({ version });
            opt = { resolveKnownTags: true, schema: "core" };
            break;
          case null:
            if (this.directives)
              delete this.directives;
            opt = null;
            break;
          default: {
            const sv = JSON.stringify(version);
            throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
          }
        }
        if (options.schema instanceof Object)
          this.schema = options.schema;
        else if (opt)
          this.schema = new Schema.Schema(Object.assign(opt, options));
        else
          throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
      }
      // json & jsonArg are only used from toJSON()
      toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver: reviver2 } = {}) {
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc: this,
          keep: !json,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this.contents, jsonArg ?? "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver2 === "function" ? applyReviver.applyReviver(reviver2, { "": res }, "", res) : res;
      }
      /**
       * A JSON representation of the document `contents`.
       *
       * @param jsonArg Used by `JSON.stringify` to indicate the array index or
       *   property name.
       */
      toJSON(jsonArg, onAnchor) {
        return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
      }
      /** A YAML representation of the document. */
      toString(options = {}) {
        if (this.errors.length > 0)
          throw new Error("Document with errors cannot be stringified");
        if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
          const s = JSON.stringify(options.indent);
          throw new Error(`"indent" option must be a positive integer, not ${s}`);
        }
        return stringifyDocument.stringifyDocument(this, options);
      }
    };
    function assertCollection(contents) {
      if (identity.isCollection(contents))
        return true;
      throw new Error("Expected a YAML collection as document contents");
    }
    exports.Document = Document;
  }
});

// node_modules/yaml/dist/errors.js
var require_errors = __commonJS({
  "node_modules/yaml/dist/errors.js"(exports) {
    "use strict";
    var YAMLError = class extends Error {
      constructor(name2, pos, code, message) {
        super();
        this.name = name2;
        this.code = code;
        this.message = message;
        this.pos = pos;
      }
    };
    var YAMLParseError = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLParseError", pos, code, message);
      }
    };
    var YAMLWarning = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLWarning", pos, code, message);
      }
    };
    var prettifyError = (src, lc) => (error) => {
      if (error.pos[0] === -1)
        return;
      error.linePos = error.pos.map((pos) => lc.linePos(pos));
      const { line, col } = error.linePos[0];
      error.message += ` at line ${line}, column ${col}`;
      let ci = col - 1;
      let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
      if (ci >= 60 && lineStr.length > 80) {
        const trimStart = Math.min(ci - 39, lineStr.length - 79);
        lineStr = "\u2026" + lineStr.substring(trimStart);
        ci -= trimStart - 1;
      }
      if (lineStr.length > 80)
        lineStr = lineStr.substring(0, 79) + "\u2026";
      if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
        let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
        if (prev.length > 80)
          prev = prev.substring(0, 79) + "\u2026\n";
        lineStr = prev + lineStr;
      }
      if (/[^ ]/.test(lineStr)) {
        let count = 1;
        const end = error.linePos[1];
        if (end?.line === line && end.col > col) {
          count = Math.max(1, Math.min(end.col - col, 80 - ci));
        }
        const pointer = " ".repeat(ci) + "^".repeat(count);
        error.message += `:

${lineStr}
${pointer}
`;
      }
    };
    exports.YAMLError = YAMLError;
    exports.YAMLParseError = YAMLParseError;
    exports.YAMLWarning = YAMLWarning;
    exports.prettifyError = prettifyError;
  }
});

// node_modules/yaml/dist/compose/resolve-props.js
var require_resolve_props = __commonJS({
  "node_modules/yaml/dist/compose/resolve-props.js"(exports) {
    "use strict";
    function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
      let spaceBefore = false;
      let atNewline = startOnNewline;
      let hasSpace = startOnNewline;
      let comment = "";
      let commentSep = "";
      let hasNewline = false;
      let reqSpace = false;
      let tab = null;
      let anchor = null;
      let tag = null;
      let newlineAfterProp = null;
      let comma = null;
      let found = null;
      let start = null;
      for (const token of tokens) {
        if (reqSpace) {
          if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
            onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
          reqSpace = false;
        }
        if (tab) {
          if (atNewline && token.type !== "comment" && token.type !== "newline") {
            onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
          }
          tab = null;
        }
        switch (token.type) {
          case "space":
            if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) {
              tab = token;
            }
            hasSpace = true;
            break;
          case "comment": {
            if (!hasSpace)
              onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
            const cb = token.source.substring(1) || " ";
            if (!comment)
              comment = cb;
            else
              comment += commentSep + cb;
            commentSep = "";
            atNewline = false;
            break;
          }
          case "newline":
            if (atNewline) {
              if (comment)
                comment += token.source;
              else if (!found || indicator !== "seq-item-ind")
                spaceBefore = true;
            } else
              commentSep += token.source;
            atNewline = true;
            hasNewline = true;
            if (anchor || tag)
              newlineAfterProp = token;
            hasSpace = true;
            break;
          case "anchor":
            if (anchor)
              onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
            if (token.source.endsWith(":"))
              onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
            anchor = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          case "tag": {
            if (tag)
              onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
            tag = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          }
          case indicator:
            if (anchor || tag)
              onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
            if (found)
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
            found = token;
            atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
            hasSpace = false;
            break;
          case "comma":
            if (flow) {
              if (comma)
                onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
              comma = token;
              atNewline = false;
              hasSpace = false;
              break;
            }
          // else fallthrough
          default:
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
            atNewline = false;
            hasSpace = false;
        }
      }
      const last = tokens[tokens.length - 1];
      const end = last ? last.offset + last.source.length : offset;
      if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
        onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
      }
      if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
        onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
      return {
        comma,
        found,
        spaceBefore,
        comment,
        hasNewline,
        anchor,
        tag,
        newlineAfterProp,
        end,
        start: start ?? end
      };
    }
    exports.resolveProps = resolveProps;
  }
});

// node_modules/yaml/dist/compose/util-contains-newline.js
var require_util_contains_newline = __commonJS({
  "node_modules/yaml/dist/compose/util-contains-newline.js"(exports) {
    "use strict";
    function containsNewline(key) {
      if (!key)
        return null;
      switch (key.type) {
        case "alias":
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          if (key.source.includes("\n"))
            return true;
          if (key.end) {
            for (const st of key.end)
              if (st.type === "newline")
                return true;
          }
          return false;
        case "flow-collection":
          for (const it of key.items) {
            for (const st of it.start)
              if (st.type === "newline")
                return true;
            if (it.sep) {
              for (const st of it.sep)
                if (st.type === "newline")
                  return true;
            }
            if (containsNewline(it.key) || containsNewline(it.value))
              return true;
          }
          return false;
        default:
          return true;
      }
    }
    exports.containsNewline = containsNewline;
  }
});

// node_modules/yaml/dist/compose/util-flow-indent-check.js
var require_util_flow_indent_check = __commonJS({
  "node_modules/yaml/dist/compose/util-flow-indent-check.js"(exports) {
    "use strict";
    var utilContainsNewline = require_util_contains_newline();
    function flowIndentCheck(indent, fc, onError) {
      if (fc?.type === "flow-collection") {
        const end = fc.end[0];
        if (end.indent === indent && (end.source === "]" || end.source === "}") && utilContainsNewline.containsNewline(fc)) {
          const msg = "Flow end indicator should be more indented than parent";
          onError(end, "BAD_INDENT", msg, true);
        }
      }
    }
    exports.flowIndentCheck = flowIndentCheck;
  }
});

// node_modules/yaml/dist/compose/util-map-includes.js
var require_util_map_includes = __commonJS({
  "node_modules/yaml/dist/compose/util-map-includes.js"(exports) {
    "use strict";
    var identity = require_identity();
    function mapIncludes(ctx, items, search) {
      const { uniqueKeys } = ctx.options;
      if (uniqueKeys === false)
        return false;
      const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || identity.isScalar(a) && identity.isScalar(b) && a.value === b.value;
      return items.some((pair) => isEqual(pair.key, search));
    }
    exports.mapIncludes = mapIncludes;
  }
});

// node_modules/yaml/dist/compose/resolve-block-map.js
var require_resolve_block_map = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-map.js"(exports) {
    "use strict";
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    var utilMapIncludes = require_util_map_includes();
    var startColMsg = "All mapping items must start at the same column";
    function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLMap.YAMLMap;
      const map = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      let offset = bm.offset;
      let commentEnd = null;
      for (const collItem of bm.items) {
        const { start, key, sep, value } = collItem;
        const keyProps = resolveProps.resolveProps(start, {
          indicator: "explicit-key-ind",
          next: key ?? sep?.[0],
          offset,
          onError,
          parentIndent: bm.indent,
          startOnNewline: true
        });
        const implicitKey = !keyProps.found;
        if (implicitKey) {
          if (key) {
            if (key.type === "block-seq")
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
            else if ("indent" in key && key.indent !== bm.indent)
              onError(offset, "BAD_INDENT", startColMsg);
          }
          if (!keyProps.anchor && !keyProps.tag && !sep) {
            commentEnd = keyProps.end;
            if (keyProps.comment) {
              if (map.comment)
                map.comment += "\n" + keyProps.comment;
              else
                map.comment = keyProps.comment;
            }
            continue;
          }
          if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) {
            onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
          }
        } else if (keyProps.found?.indent !== bm.indent) {
          onError(offset, "BAD_INDENT", startColMsg);
        }
        ctx.atKey = true;
        const keyStart = keyProps.end;
        const keyNode = key ? composeNode(ctx, key, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
        ctx.atKey = false;
        if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
          onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
        const valueProps = resolveProps.resolveProps(sep ?? [], {
          indicator: "map-value-ind",
          next: value,
          offset: keyNode.range[2],
          onError,
          parentIndent: bm.indent,
          startOnNewline: !key || key.type === "block-scalar"
        });
        offset = valueProps.end;
        if (valueProps.found) {
          if (implicitKey) {
            if (value?.type === "block-map" && !valueProps.hasNewline)
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
            if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
              onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep, null, valueProps, onError);
          if (ctx.schema.compat)
            utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
          offset = valueNode.range[2];
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        } else {
          if (implicitKey)
            onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
          if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        }
      }
      if (commentEnd && commentEnd < offset)
        onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
      map.range = [bm.offset, offset, commentEnd ?? offset];
      return map;
    }
    exports.resolveBlockMap = resolveBlockMap;
  }
});

// node_modules/yaml/dist/compose/resolve-block-seq.js
var require_resolve_block_seq = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-seq.js"(exports) {
    "use strict";
    var YAMLSeq = require_YAMLSeq();
    var resolveProps = require_resolve_props();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLSeq.YAMLSeq;
      const seq = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = bs.offset;
      let commentEnd = null;
      for (const { start, value } of bs.items) {
        const props = resolveProps.resolveProps(start, {
          indicator: "seq-item-ind",
          next: value,
          offset,
          onError,
          parentIndent: bs.indent,
          startOnNewline: true
        });
        if (!props.found) {
          if (props.anchor || props.tag || value) {
            if (value?.type === "block-seq")
              onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
            else
              onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
          } else {
            commentEnd = props.end;
            if (props.comment)
              seq.comment = props.comment;
            continue;
          }
        }
        const node = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
        offset = node.range[2];
        seq.items.push(node);
      }
      seq.range = [bs.offset, offset, commentEnd ?? offset];
      return seq;
    }
    exports.resolveBlockSeq = resolveBlockSeq;
  }
});

// node_modules/yaml/dist/compose/resolve-end.js
var require_resolve_end = __commonJS({
  "node_modules/yaml/dist/compose/resolve-end.js"(exports) {
    "use strict";
    function resolveEnd(end, offset, reqSpace, onError) {
      let comment = "";
      if (end) {
        let hasSpace = false;
        let sep = "";
        for (const token of end) {
          const { source, type } = token;
          switch (type) {
            case "space":
              hasSpace = true;
              break;
            case "comment": {
              if (reqSpace && !hasSpace)
                onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
              const cb = source.substring(1) || " ";
              if (!comment)
                comment = cb;
              else
                comment += sep + cb;
              sep = "";
              break;
            }
            case "newline":
              if (comment)
                sep += source;
              hasSpace = true;
              break;
            default:
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
          }
          offset += source.length;
        }
      }
      return { comment, offset };
    }
    exports.resolveEnd = resolveEnd;
  }
});

// node_modules/yaml/dist/compose/resolve-flow-collection.js
var require_resolve_flow_collection = __commonJS({
  "node_modules/yaml/dist/compose/resolve-flow-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilMapIncludes = require_util_map_includes();
    var blockMsg = "Block collections are not allowed within flow collections";
    var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
    function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
      const isMap3 = fc.start.source === "{";
      const fcName = isMap3 ? "flow map" : "flow sequence";
      const NodeClass = tag?.nodeClass ?? (isMap3 ? YAMLMap.YAMLMap : YAMLSeq.YAMLSeq);
      const coll = new NodeClass(ctx.schema);
      coll.flow = true;
      const atRoot = ctx.atRoot;
      if (atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = fc.offset + fc.start.source.length;
      for (let i = 0; i < fc.items.length; ++i) {
        const collItem = fc.items[i];
        const { start, key, sep, value } = collItem;
        const props = resolveProps.resolveProps(start, {
          flow: fcName,
          indicator: "explicit-key-ind",
          next: key ?? sep?.[0],
          offset,
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (!props.found) {
          if (!props.anchor && !props.tag && !sep && !value) {
            if (i === 0 && props.comma)
              onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
            else if (i < fc.items.length - 1)
              onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
            if (props.comment) {
              if (coll.comment)
                coll.comment += "\n" + props.comment;
              else
                coll.comment = props.comment;
            }
            offset = props.end;
            continue;
          }
          if (!isMap3 && ctx.options.strict && utilContainsNewline.containsNewline(key))
            onError(
              key,
              // checked by containsNewline()
              "MULTILINE_IMPLICIT_KEY",
              "Implicit keys of flow sequence pairs need to be on a single line"
            );
        }
        if (i === 0) {
          if (props.comma)
            onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
        } else {
          if (!props.comma)
            onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
          if (props.comment) {
            let prevItemComment = "";
            loop: for (const st of start) {
              switch (st.type) {
                case "comma":
                case "space":
                  break;
                case "comment":
                  prevItemComment = st.source.substring(1);
                  break loop;
                default:
                  break loop;
              }
            }
            if (prevItemComment) {
              let prev = coll.items[coll.items.length - 1];
              if (identity.isPair(prev))
                prev = prev.value ?? prev.key;
              if (prev.comment)
                prev.comment += "\n" + prevItemComment;
              else
                prev.comment = prevItemComment;
              props.comment = props.comment.substring(prevItemComment.length + 1);
            }
          }
        }
        if (!isMap3 && !sep && !props.found) {
          const valueNode = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep, null, props, onError);
          coll.items.push(valueNode);
          offset = valueNode.range[2];
          if (isBlock(value))
            onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
        } else {
          ctx.atKey = true;
          const keyStart = props.end;
          const keyNode = key ? composeNode(ctx, key, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
          if (isBlock(key))
            onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
          ctx.atKey = false;
          const valueProps = resolveProps.resolveProps(sep ?? [], {
            flow: fcName,
            indicator: "map-value-ind",
            next: value,
            offset: keyNode.range[2],
            onError,
            parentIndent: fc.indent,
            startOnNewline: false
          });
          if (valueProps.found) {
            if (!isMap3 && !props.found && ctx.options.strict) {
              if (sep)
                for (const st of sep) {
                  if (st === valueProps.found)
                    break;
                  if (st.type === "newline") {
                    onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                    break;
                  }
                }
              if (props.start < valueProps.found.offset - 1024)
                onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
            }
          } else if (value) {
            if ("source" in value && value.source?.[0] === ":")
              onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
            else
              onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep, null, valueProps, onError) : null;
          if (valueNode) {
            if (isBlock(value))
              onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
          } else if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          if (isMap3) {
            const map = coll;
            if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
              onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
            map.items.push(pair);
          } else {
            const map = new YAMLMap.YAMLMap(ctx.schema);
            map.flow = true;
            map.items.push(pair);
            const endRange = (valueNode ?? keyNode).range;
            map.range = [keyNode.range[0], endRange[1], endRange[2]];
            coll.items.push(map);
          }
          offset = valueNode ? valueNode.range[2] : valueProps.end;
        }
      }
      const expectedEnd = isMap3 ? "}" : "]";
      const [ce, ...ee] = fc.end;
      let cePos = offset;
      if (ce?.source === expectedEnd)
        cePos = ce.offset + ce.source.length;
      else {
        const name2 = fcName[0].toUpperCase() + fcName.substring(1);
        const msg = atRoot ? `${name2} must end with a ${expectedEnd}` : `${name2} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
        onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
        if (ce && ce.source.length !== 1)
          ee.unshift(ce);
      }
      if (ee.length > 0) {
        const end = resolveEnd.resolveEnd(ee, cePos, ctx.options.strict, onError);
        if (end.comment) {
          if (coll.comment)
            coll.comment += "\n" + end.comment;
          else
            coll.comment = end.comment;
        }
        coll.range = [fc.offset, cePos, end.offset];
      } else {
        coll.range = [fc.offset, cePos, cePos];
      }
      return coll;
    }
    exports.resolveFlowCollection = resolveFlowCollection;
  }
});

// node_modules/yaml/dist/compose/compose-collection.js
var require_compose_collection = __commonJS({
  "node_modules/yaml/dist/compose/compose-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveBlockMap = require_resolve_block_map();
    var resolveBlockSeq = require_resolve_block_seq();
    var resolveFlowCollection = require_resolve_flow_collection();
    function resolveCollection(CN, ctx, token, onError, tagName, tag) {
      const coll = token.type === "block-map" ? resolveBlockMap.resolveBlockMap(CN, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token, onError, tag) : resolveFlowCollection.resolveFlowCollection(CN, ctx, token, onError, tag);
      const Coll = coll.constructor;
      if (tagName === "!" || tagName === Coll.tagName) {
        coll.tag = Coll.tagName;
        return coll;
      }
      if (tagName)
        coll.tag = tagName;
      return coll;
    }
    function composeCollection(CN, ctx, token, props, onError) {
      const tagToken = props.tag;
      const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
      if (token.type === "block-seq") {
        const { anchor, newlineAfterProp: nl } = props;
        const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
        if (lastProp && (!nl || nl.offset < lastProp.offset)) {
          const message = "Missing newline after block sequence props";
          onError(lastProp, "MISSING_CHAR", message);
        }
      }
      const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
      if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.YAMLSeq.tagName && expType === "seq") {
        return resolveCollection(CN, ctx, token, onError, tagName);
      }
      let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
      if (!tag) {
        const kt = ctx.schema.knownTags[tagName];
        if (kt?.collection === expType) {
          ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
          tag = kt;
        } else {
          if (kt) {
            onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
          } else {
            onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
          }
          return resolveCollection(CN, ctx, token, onError, tagName);
        }
      }
      const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
      const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
      const node = identity.isNode(res) ? res : new Scalar.Scalar(res);
      node.range = coll.range;
      node.tag = tagName;
      if (tag?.format)
        node.format = tag.format;
      return node;
    }
    exports.composeCollection = composeCollection;
  }
});

// node_modules/yaml/dist/compose/resolve-block-scalar.js
var require_resolve_block_scalar = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function resolveBlockScalar(ctx, scalar, onError) {
      const start = scalar.offset;
      const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
      if (!header)
        return { value: "", type: null, comment: "", range: [start, start, start] };
      const type = header.mode === ">" ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
      const lines = scalar.source ? splitLines(scalar.source) : [];
      let chompStart = lines.length;
      for (let i = lines.length - 1; i >= 0; --i) {
        const content = lines[i][1];
        if (content === "" || content === "\r")
          chompStart = i;
        else
          break;
      }
      if (chompStart === 0) {
        const value2 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
        let end2 = start + header.length;
        if (scalar.source)
          end2 += scalar.source.length;
        return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
      }
      let trimIndent = scalar.indent + header.indent;
      let offset = scalar.offset + header.length;
      let contentStart = 0;
      for (let i = 0; i < chompStart; ++i) {
        const [indent, content] = lines[i];
        if (content === "" || content === "\r") {
          if (header.indent === 0 && indent.length > trimIndent)
            trimIndent = indent.length;
        } else {
          if (indent.length < trimIndent) {
            const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
            onError(offset + indent.length, "MISSING_CHAR", message);
          }
          if (header.indent === 0)
            trimIndent = indent.length;
          contentStart = i;
          if (trimIndent === 0 && !ctx.atRoot) {
            const message = "Block scalar values in collections must be indented";
            onError(offset, "BAD_INDENT", message);
          }
          break;
        }
        offset += indent.length + content.length + 1;
      }
      for (let i = lines.length - 1; i >= chompStart; --i) {
        if (lines[i][0].length > trimIndent)
          chompStart = i + 1;
      }
      let value = "";
      let sep = "";
      let prevMoreIndented = false;
      for (let i = 0; i < contentStart; ++i)
        value += lines[i][0].slice(trimIndent) + "\n";
      for (let i = contentStart; i < chompStart; ++i) {
        let [indent, content] = lines[i];
        offset += indent.length + content.length + 1;
        const crlf = content[content.length - 1] === "\r";
        if (crlf)
          content = content.slice(0, -1);
        if (content && indent.length < trimIndent) {
          const src = header.indent ? "explicit indentation indicator" : "first line";
          const message = `Block scalar lines must not be less indented than their ${src}`;
          onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
          indent = "";
        }
        if (type === Scalar.Scalar.BLOCK_LITERAL) {
          value += sep + indent.slice(trimIndent) + content;
          sep = "\n";
        } else if (indent.length > trimIndent || content[0] === "	") {
          if (sep === " ")
            sep = "\n";
          else if (!prevMoreIndented && sep === "\n")
            sep = "\n\n";
          value += sep + indent.slice(trimIndent) + content;
          sep = "\n";
          prevMoreIndented = true;
        } else if (content === "") {
          if (sep === "\n")
            value += "\n";
          else
            sep = "\n";
        } else {
          value += sep + content;
          sep = " ";
          prevMoreIndented = false;
        }
      }
      switch (header.chomp) {
        case "-":
          break;
        case "+":
          for (let i = chompStart; i < lines.length; ++i)
            value += "\n" + lines[i][0].slice(trimIndent);
          if (value[value.length - 1] !== "\n")
            value += "\n";
          break;
        default:
          value += "\n";
      }
      const end = start + header.length + scalar.source.length;
      return { value, type, comment: header.comment, range: [start, end, end] };
    }
    function parseBlockScalarHeader({ offset, props }, strict, onError) {
      if (props[0].type !== "block-scalar-header") {
        onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
        return null;
      }
      const { source } = props[0];
      const mode = source[0];
      let indent = 0;
      let chomp = "";
      let error = -1;
      for (let i = 1; i < source.length; ++i) {
        const ch = source[i];
        if (!chomp && (ch === "-" || ch === "+"))
          chomp = ch;
        else {
          const n = Number(ch);
          if (!indent && n)
            indent = n;
          else if (error === -1)
            error = offset + i;
        }
      }
      if (error !== -1)
        onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
      let hasSpace = false;
      let comment = "";
      let length = source.length;
      for (let i = 1; i < props.length; ++i) {
        const token = props[i];
        switch (token.type) {
          case "space":
            hasSpace = true;
          // fallthrough
          case "newline":
            length += token.source.length;
            break;
          case "comment":
            if (strict && !hasSpace) {
              const message = "Comments must be separated from other tokens by white space characters";
              onError(token, "MISSING_CHAR", message);
            }
            length += token.source.length;
            comment = token.source.substring(1);
            break;
          case "error":
            onError(token, "UNEXPECTED_TOKEN", token.message);
            length += token.source.length;
            break;
          /* istanbul ignore next should not happen */
          default: {
            const message = `Unexpected token in block scalar header: ${token.type}`;
            onError(token, "UNEXPECTED_TOKEN", message);
            const ts = token.source;
            if (ts && typeof ts === "string")
              length += ts.length;
          }
        }
      }
      return { mode, indent, chomp, comment, length };
    }
    function splitLines(source) {
      const split = source.split(/\n( *)/);
      const first = split[0];
      const m = first.match(/^( *)/);
      const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first];
      const lines = [line0];
      for (let i = 1; i < split.length; i += 2)
        lines.push([split[i], split[i + 1]]);
      return lines;
    }
    exports.resolveBlockScalar = resolveBlockScalar;
  }
});

// node_modules/yaml/dist/compose/resolve-flow-scalar.js
var require_resolve_flow_scalar = __commonJS({
  "node_modules/yaml/dist/compose/resolve-flow-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var resolveEnd = require_resolve_end();
    function resolveFlowScalar(scalar, strict, onError) {
      const { offset, type, source, end } = scalar;
      let _type;
      let value;
      const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
      switch (type) {
        case "scalar":
          _type = Scalar.Scalar.PLAIN;
          value = plainValue(source, _onError);
          break;
        case "single-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_SINGLE;
          value = singleQuotedValue(source, _onError);
          break;
        case "double-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_DOUBLE;
          value = doubleQuotedValue(source, _onError);
          break;
        /* istanbul ignore next should not happen */
        default:
          onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
          return {
            value: "",
            type: null,
            comment: "",
            range: [offset, offset + source.length, offset + source.length]
          };
      }
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
      return {
        value,
        type: _type,
        comment: re.comment,
        range: [offset, valueEnd, re.offset]
      };
    }
    function plainValue(source, onError) {
      let badChar = "";
      switch (source[0]) {
        /* istanbul ignore next should not happen */
        case "	":
          badChar = "a tab character";
          break;
        case ",":
          badChar = "flow indicator character ,";
          break;
        case "%":
          badChar = "directive indicator character %";
          break;
        case "|":
        case ">": {
          badChar = `block scalar indicator ${source[0]}`;
          break;
        }
        case "@":
        case "`": {
          badChar = `reserved character ${source[0]}`;
          break;
        }
      }
      if (badChar)
        onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
      return unfoldLines(source);
    }
    function singleQuotedValue(source, onError) {
      if (source[source.length - 1] !== "'" || source.length === 1)
        onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
      return unfoldLines(source.slice(1, -1)).replace(/''/g, "'");
    }
    function unfoldLines(source) {
      const line = /(.*?)\r?\n/sy;
      let match = line.exec(source);
      if (!match)
        return source;
      let trimEnd, trimBoth;
      try {
        trimEnd = new RegExp("(?<![ 	])[ 	]+$");
        trimBoth = new RegExp("^[ 	]+|(?<![ 	])[ 	]+$", "g");
      } catch {
        trimEnd = /[ \t]+$/;
        trimBoth = /^[ \t]+|[ \t]+$/g;
      }
      let res = match[1].replace(trimEnd, "");
      let sep = " ";
      let pos = line.lastIndex;
      while (match = line.exec(source)) {
        const lm = match[1].replace(trimBoth, "");
        if (lm === "") {
          if (sep === "\n")
            res += sep;
          else
            sep = "\n";
        } else {
          res += sep + lm;
          sep = " ";
        }
        pos = line.lastIndex;
      }
      const last = /[ \t]*(.*)/sy;
      last.lastIndex = pos;
      match = last.exec(source);
      return res + sep + (match?.[1] ?? "");
    }
    function doubleQuotedValue(source, onError) {
      let res = "";
      for (let i = 1; i < source.length - 1; ++i) {
        const ch = source[i];
        if (ch === "\r" && source[i + 1] === "\n")
          continue;
        if (ch === "\n") {
          const { fold, offset } = foldNewline(source, i);
          res += fold;
          i = offset;
        } else if (ch === "\\") {
          let next = source[++i];
          const cc = escapeCodes[next];
          if (cc)
            res += cc;
          else if (next === "\n") {
            next = source[i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "\r" && source[i + 1] === "\n") {
            next = source[++i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "x" || next === "u" || next === "U") {
            const length = next === "x" ? 2 : next === "u" ? 4 : 8;
            res += parseCharCode(source, i + 1, length, onError);
            i += length;
          } else {
            const raw = source.substr(i - 1, 2);
            onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
            res += raw;
          }
        } else if (ch === " " || ch === "	") {
          const wsStart = i;
          let next = source[i + 1];
          while (next === " " || next === "	")
            next = source[++i + 1];
          if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n"))
            res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
        } else {
          res += ch;
        }
      }
      if (source[source.length - 1] !== '"' || source.length === 1)
        onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
      return res;
    }
    function foldNewline(source, offset) {
      let fold = "";
      let ch = source[offset + 1];
      while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
        if (ch === "\r" && source[offset + 2] !== "\n")
          break;
        if (ch === "\n")
          fold += "\n";
        offset += 1;
        ch = source[offset + 1];
      }
      if (!fold)
        fold = " ";
      return { fold, offset };
    }
    var escapeCodes = {
      "0": "\0",
      // null character
      a: "\x07",
      // bell character
      b: "\b",
      // backspace
      e: "\x1B",
      // escape character
      f: "\f",
      // form feed
      n: "\n",
      // line feed
      r: "\r",
      // carriage return
      t: "	",
      // horizontal tab
      v: "\v",
      // vertical tab
      N: "\x85",
      // Unicode next line
      _: "\xA0",
      // Unicode non-breaking space
      L: "\u2028",
      // Unicode line separator
      P: "\u2029",
      // Unicode paragraph separator
      " ": " ",
      '"': '"',
      "/": "/",
      "\\": "\\",
      "	": "	"
    };
    function parseCharCode(source, offset, length, onError) {
      const cc = source.substr(offset, length);
      const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
      const code = ok ? parseInt(cc, 16) : NaN;
      try {
        return String.fromCodePoint(code);
      } catch {
        const raw = source.substr(offset - 2, length + 2);
        onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
        return raw;
      }
    }
    exports.resolveFlowScalar = resolveFlowScalar;
  }
});

// node_modules/yaml/dist/compose/compose-scalar.js
var require_compose_scalar = __commonJS({
  "node_modules/yaml/dist/compose/compose-scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    function composeScalar(ctx, token, tagToken, onError) {
      const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar.resolveBlockScalar(ctx, token, onError) : resolveFlowScalar.resolveFlowScalar(token, ctx.options.strict, onError);
      const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
      let tag;
      if (ctx.options.stringKeys && ctx.atKey) {
        tag = ctx.schema[identity.SCALAR];
      } else if (tagName)
        tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
      else if (token.type === "scalar")
        tag = findScalarTagByTest(ctx, value, token, onError);
      else
        tag = ctx.schema[identity.SCALAR];
      let scalar;
      try {
        const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
        scalar = identity.isScalar(res) ? res : new Scalar.Scalar(res);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
        scalar = new Scalar.Scalar(value);
      }
      scalar.range = range;
      scalar.source = value;
      if (type)
        scalar.type = type;
      if (tagName)
        scalar.tag = tagName;
      if (tag.format)
        scalar.format = tag.format;
      if (comment)
        scalar.comment = comment;
      return scalar;
    }
    function findScalarTagByName(schema2, value, tagName, tagToken, onError) {
      if (tagName === "!")
        return schema2[identity.SCALAR];
      const matchWithTest = [];
      for (const tag of schema2.tags) {
        if (!tag.collection && tag.tag === tagName) {
          if (tag.default && tag.test)
            matchWithTest.push(tag);
          else
            return tag;
        }
      }
      for (const tag of matchWithTest)
        if (tag.test?.test(value))
          return tag;
      const kt = schema2.knownTags[tagName];
      if (kt && !kt.collection) {
        schema2.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
        return kt;
      }
      onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
      return schema2[identity.SCALAR];
    }
    function findScalarTagByTest({ atKey, directives, schema: schema2 }, value, token, onError) {
      const tag = schema2.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema2[identity.SCALAR];
      if (schema2.compat) {
        const compat = schema2.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema2[identity.SCALAR];
        if (tag.tag !== compat.tag) {
          const ts = directives.tagString(tag.tag);
          const cs = directives.tagString(compat.tag);
          const msg = `Value may be parsed as either ${ts} or ${cs}`;
          onError(token, "TAG_RESOLVE_FAILED", msg, true);
        }
      }
      return tag;
    }
    exports.composeScalar = composeScalar;
  }
});

// node_modules/yaml/dist/compose/util-empty-scalar-position.js
var require_util_empty_scalar_position = __commonJS({
  "node_modules/yaml/dist/compose/util-empty-scalar-position.js"(exports) {
    "use strict";
    function emptyScalarPosition(offset, before, pos) {
      if (before) {
        pos ?? (pos = before.length);
        for (let i = pos - 1; i >= 0; --i) {
          let st = before[i];
          switch (st.type) {
            case "space":
            case "comment":
            case "newline":
              offset -= st.source.length;
              continue;
          }
          st = before[++i];
          while (st?.type === "space") {
            offset += st.source.length;
            st = before[++i];
          }
          break;
        }
      }
      return offset;
    }
    exports.emptyScalarPosition = emptyScalarPosition;
  }
});

// node_modules/yaml/dist/compose/compose-node.js
var require_compose_node = __commonJS({
  "node_modules/yaml/dist/compose/compose-node.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var composeCollection = require_compose_collection();
    var composeScalar = require_compose_scalar();
    var resolveEnd = require_resolve_end();
    var utilEmptyScalarPosition = require_util_empty_scalar_position();
    var CN = { composeNode, composeEmptyNode };
    function composeNode(ctx, token, props, onError) {
      const atKey = ctx.atKey;
      const { spaceBefore, comment, anchor, tag } = props;
      let node;
      let isSrcToken = true;
      switch (token.type) {
        case "alias":
          node = composeAlias(ctx, token, onError);
          if (anchor || tag)
            onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
          break;
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "block-scalar":
          node = composeScalar.composeScalar(ctx, token, tag, onError);
          if (anchor)
            node.anchor = anchor.source.substring(1);
          break;
        case "block-map":
        case "block-seq":
        case "flow-collection":
          try {
            node = composeCollection.composeCollection(CN, ctx, token, props, onError);
            if (anchor)
              node.anchor = anchor.source.substring(1);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            onError(token, "RESOURCE_EXHAUSTION", message);
          }
          break;
        default: {
          const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
          onError(token, "UNEXPECTED_TOKEN", message);
          isSrcToken = false;
        }
      }
      node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
      if (anchor && node.anchor === "")
        onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      if (atKey && ctx.options.stringKeys && (!identity.isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
        const msg = "With stringKeys, all keys must be strings";
        onError(tag ?? token, "NON_STRING_KEY", msg);
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        if (token.type === "scalar" && token.source === "")
          node.comment = comment;
        else
          node.commentBefore = comment;
      }
      if (ctx.options.keepSourceTokens && isSrcToken)
        node.srcToken = token;
      return node;
    }
    function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
      const token = {
        type: "scalar",
        offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
        indent: -1,
        source: ""
      };
      const node = composeScalar.composeScalar(ctx, token, tag, onError);
      if (anchor) {
        node.anchor = anchor.source.substring(1);
        if (node.anchor === "")
          onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        node.comment = comment;
        node.range[2] = end;
      }
      return node;
    }
    function composeAlias({ options }, { offset, source, end }, onError) {
      const alias = new Alias.Alias(source.substring(1));
      if (alias.source === "")
        onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
      if (alias.source.endsWith(":"))
        onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
      alias.range = [offset, valueEnd, re.offset];
      if (re.comment)
        alias.comment = re.comment;
      return alias;
    }
    exports.composeEmptyNode = composeEmptyNode;
    exports.composeNode = composeNode;
  }
});

// node_modules/yaml/dist/compose/compose-doc.js
var require_compose_doc = __commonJS({
  "node_modules/yaml/dist/compose/compose-doc.js"(exports) {
    "use strict";
    var Document = require_Document();
    var composeNode = require_compose_node();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    function composeDoc(options, directives, { offset, start, value, end }, onError) {
      const opts = Object.assign({ _directives: directives }, options);
      const doc = new Document.Document(void 0, opts);
      const ctx = {
        atKey: false,
        atRoot: true,
        directives: doc.directives,
        options: doc.options,
        schema: doc.schema
      };
      const props = resolveProps.resolveProps(start, {
        indicator: "doc-start",
        next: value ?? end?.[0],
        offset,
        onError,
        parentIndent: 0,
        startOnNewline: true
      });
      if (props.found) {
        doc.directives.docStart = true;
        if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
          onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
      }
      doc.contents = value ? composeNode.composeNode(ctx, value, props, onError) : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
      const contentEnd = doc.contents.range[2];
      const re = resolveEnd.resolveEnd(end, contentEnd, false, onError);
      if (re.comment)
        doc.comment = re.comment;
      doc.range = [offset, contentEnd, re.offset];
      return doc;
    }
    exports.composeDoc = composeDoc;
  }
});

// node_modules/yaml/dist/compose/composer.js
var require_composer = __commonJS({
  "node_modules/yaml/dist/compose/composer.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var directives = require_directives();
    var Document = require_Document();
    var errors = require_errors();
    var identity = require_identity();
    var composeDoc = require_compose_doc();
    var resolveEnd = require_resolve_end();
    function getErrorPos(src) {
      if (typeof src === "number")
        return [src, src + 1];
      if (Array.isArray(src))
        return src.length === 2 ? src : [src[0], src[1]];
      const { offset, source } = src;
      return [offset, offset + (typeof source === "string" ? source.length : 1)];
    }
    function parsePrelude(prelude) {
      let comment = "";
      let atComment = false;
      let afterEmptyLine = false;
      for (let i = 0; i < prelude.length; ++i) {
        const source = prelude[i];
        switch (source[0]) {
          case "#":
            comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
            atComment = true;
            afterEmptyLine = false;
            break;
          case "%":
            if (prelude[i + 1]?.[0] !== "#")
              i += 1;
            atComment = false;
            break;
          default:
            if (!atComment)
              afterEmptyLine = true;
            atComment = false;
        }
      }
      return { comment, afterEmptyLine };
    }
    var Composer = class {
      constructor(options = {}) {
        this.doc = null;
        this.atDirectives = false;
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
        this.onError = (source, code, message, warning) => {
          const pos = getErrorPos(source);
          if (warning)
            this.warnings.push(new errors.YAMLWarning(pos, code, message));
          else
            this.errors.push(new errors.YAMLParseError(pos, code, message));
        };
        this.directives = new directives.Directives({ version: options.version || "1.2" });
        this.options = options;
      }
      decorate(doc, afterDoc) {
        const { comment, afterEmptyLine } = parsePrelude(this.prelude);
        if (comment) {
          const dc = doc.contents;
          if (afterDoc) {
            doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
          } else if (afterEmptyLine || doc.directives.docStart || !dc) {
            doc.commentBefore = comment;
          } else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
            let it = dc.items[0];
            if (identity.isPair(it))
              it = it.key;
            const cb = it.commentBefore;
            it.commentBefore = cb ? `${comment}
${cb}` : comment;
          } else {
            const cb = dc.commentBefore;
            dc.commentBefore = cb ? `${comment}
${cb}` : comment;
          }
        }
        if (afterDoc) {
          for (let i = 0; i < this.errors.length; ++i)
            doc.errors.push(this.errors[i]);
          for (let i = 0; i < this.warnings.length; ++i)
            doc.warnings.push(this.warnings[i]);
        } else {
          doc.errors = this.errors;
          doc.warnings = this.warnings;
        }
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
      }
      /**
       * Current stream status information.
       *
       * Mostly useful at the end of input for an empty stream.
       */
      streamInfo() {
        return {
          comment: parsePrelude(this.prelude).comment,
          directives: this.directives,
          errors: this.errors,
          warnings: this.warnings
        };
      }
      /**
       * Compose tokens into documents.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *compose(tokens, forceDoc = false, endOffset = -1) {
        for (const token of tokens)
          yield* this.next(token);
        yield* this.end(forceDoc, endOffset);
      }
      /** Advance the composer by one CST token. */
      *next(token) {
        if (node_process.env.LOG_STREAM)
          console.dir(token, { depth: null });
        switch (token.type) {
          case "directive":
            this.directives.add(token.source, (offset, message, warning) => {
              const pos = getErrorPos(token);
              pos[0] += offset;
              this.onError(pos, "BAD_DIRECTIVE", message, warning);
            });
            this.prelude.push(token.source);
            this.atDirectives = true;
            break;
          case "document": {
            const doc = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
            if (this.atDirectives && !doc.directives.docStart)
              this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
            this.decorate(doc, false);
            if (this.doc)
              yield this.doc;
            this.doc = doc;
            this.atDirectives = false;
            break;
          }
          case "byte-order-mark":
          case "space":
            break;
          case "comment":
          case "newline":
            this.prelude.push(token.source);
            break;
          case "error": {
            const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
            const error = new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
            if (this.atDirectives || !this.doc)
              this.errors.push(error);
            else
              this.doc.errors.push(error);
            break;
          }
          case "doc-end": {
            if (!this.doc) {
              const msg = "Unexpected doc-end without preceding document";
              this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
              break;
            }
            this.doc.directives.docEnd = true;
            const end = resolveEnd.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
            this.decorate(this.doc, true);
            if (end.comment) {
              const dc = this.doc.comment;
              this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
            }
            this.doc.range[2] = end.offset;
            break;
          }
          default:
            this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
        }
      }
      /**
       * Call at end of input to yield any remaining document.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *end(forceDoc = false, endOffset = -1) {
        if (this.doc) {
          this.decorate(this.doc, true);
          yield this.doc;
          this.doc = null;
        } else if (forceDoc) {
          const opts = Object.assign({ _directives: this.directives }, this.options);
          const doc = new Document.Document(void 0, opts);
          if (this.atDirectives)
            this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
          doc.range = [0, endOffset, endOffset];
          this.decorate(doc, false);
          yield doc;
        }
      }
    };
    exports.Composer = Composer;
  }
});

// node_modules/yaml/dist/parse/cst-scalar.js
var require_cst_scalar = __commonJS({
  "node_modules/yaml/dist/parse/cst-scalar.js"(exports) {
    "use strict";
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    var errors = require_errors();
    var stringifyString = require_stringifyString();
    function resolveAsScalar(token, strict = true, onError) {
      if (token) {
        const _onError = (pos, code, message) => {
          const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
          if (onError)
            onError(offset, code, message);
          else
            throw new errors.YAMLParseError([offset, offset + 1], code, message);
        };
        switch (token.type) {
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
          case "block-scalar":
            return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
        }
      }
      return null;
    }
    function createScalarToken(value, context) {
      const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey,
        indent: indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      const end = context.end ?? [
        { type: "newline", offset: -1, indent, source: "\n" }
      ];
      switch (source[0]) {
        case "|":
        case ">": {
          const he = source.indexOf("\n");
          const head = source.substring(0, he);
          const body = source.substring(he + 1) + "\n";
          const props = [
            { type: "block-scalar-header", offset, indent, source: head }
          ];
          if (!addEndtoBlockProps(props, end))
            props.push({ type: "newline", offset: -1, indent, source: "\n" });
          return { type: "block-scalar", offset, indent, props, source: body };
        }
        case '"':
          return { type: "double-quoted-scalar", offset, indent, source, end };
        case "'":
          return { type: "single-quoted-scalar", offset, indent, source, end };
        default:
          return { type: "scalar", offset, indent, source, end };
      }
    }
    function setScalarValue(token, value, context = {}) {
      let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
      let indent = "indent" in token ? token.indent : null;
      if (afterKey && typeof indent === "number")
        indent += 2;
      if (!type)
        switch (token.type) {
          case "single-quoted-scalar":
            type = "QUOTE_SINGLE";
            break;
          case "double-quoted-scalar":
            type = "QUOTE_DOUBLE";
            break;
          case "block-scalar": {
            const header = token.props[0];
            if (header.type !== "block-scalar-header")
              throw new Error("Invalid block scalar header");
            type = header.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
            break;
          }
          default:
            type = "PLAIN";
        }
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey: implicitKey || indent === null,
        indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      switch (source[0]) {
        case "|":
        case ">":
          setBlockScalarValue(token, source);
          break;
        case '"':
          setFlowScalarValue(token, source, "double-quoted-scalar");
          break;
        case "'":
          setFlowScalarValue(token, source, "single-quoted-scalar");
          break;
        default:
          setFlowScalarValue(token, source, "scalar");
      }
    }
    function setBlockScalarValue(token, source) {
      const he = source.indexOf("\n");
      const head = source.substring(0, he);
      const body = source.substring(he + 1) + "\n";
      if (token.type === "block-scalar") {
        const header = token.props[0];
        if (header.type !== "block-scalar-header")
          throw new Error("Invalid block scalar header");
        header.source = head;
        token.source = body;
      } else {
        const { offset } = token;
        const indent = "indent" in token ? token.indent : -1;
        const props = [
          { type: "block-scalar-header", offset, indent, source: head }
        ];
        if (!addEndtoBlockProps(props, "end" in token ? token.end : void 0))
          props.push({ type: "newline", offset: -1, indent, source: "\n" });
        for (const key of Object.keys(token))
          if (key !== "type" && key !== "offset")
            delete token[key];
        Object.assign(token, { type: "block-scalar", indent, props, source: body });
      }
    }
    function addEndtoBlockProps(props, end) {
      if (end)
        for (const st of end)
          switch (st.type) {
            case "space":
            case "comment":
              props.push(st);
              break;
            case "newline":
              props.push(st);
              return true;
          }
      return false;
    }
    function setFlowScalarValue(token, source, type) {
      switch (token.type) {
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          token.type = type;
          token.source = source;
          break;
        case "block-scalar": {
          const end = token.props.slice(1);
          let oa = source.length;
          if (token.props[0].type === "block-scalar-header")
            oa -= token.props[0].source.length;
          for (const tok of end)
            tok.offset += oa;
          delete token.props;
          Object.assign(token, { type, source, end });
          break;
        }
        case "block-map":
        case "block-seq": {
          const offset = token.offset + source.length;
          const nl = { type: "newline", offset, indent: token.indent, source: "\n" };
          delete token.items;
          Object.assign(token, { type, source, end: [nl] });
          break;
        }
        default: {
          const indent = "indent" in token ? token.indent : -1;
          const end = "end" in token && Array.isArray(token.end) ? token.end.filter((st) => st.type === "space" || st.type === "comment" || st.type === "newline") : [];
          for (const key of Object.keys(token))
            if (key !== "type" && key !== "offset")
              delete token[key];
          Object.assign(token, { type, indent, source, end });
        }
      }
    }
    exports.createScalarToken = createScalarToken;
    exports.resolveAsScalar = resolveAsScalar;
    exports.setScalarValue = setScalarValue;
  }
});

// node_modules/yaml/dist/parse/cst-stringify.js
var require_cst_stringify = __commonJS({
  "node_modules/yaml/dist/parse/cst-stringify.js"(exports) {
    "use strict";
    var stringify = (cst) => "type" in cst ? stringifyToken(cst) : stringifyItem(cst);
    function stringifyToken(token) {
      switch (token.type) {
        case "block-scalar": {
          let res = "";
          for (const tok of token.props)
            res += stringifyToken(tok);
          return res + token.source;
        }
        case "block-map":
        case "block-seq": {
          let res = "";
          for (const item of token.items)
            res += stringifyItem(item);
          return res;
        }
        case "flow-collection": {
          let res = token.start.source;
          for (const item of token.items)
            res += stringifyItem(item);
          for (const st of token.end)
            res += st.source;
          return res;
        }
        case "document": {
          let res = stringifyItem(token);
          if (token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
        default: {
          let res = token.source;
          if ("end" in token && token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
      }
    }
    function stringifyItem({ start, key, sep, value }) {
      let res = "";
      for (const st of start)
        res += st.source;
      if (key)
        res += stringifyToken(key);
      if (sep)
        for (const st of sep)
          res += st.source;
      if (value)
        res += stringifyToken(value);
      return res;
    }
    exports.stringify = stringify;
  }
});

// node_modules/yaml/dist/parse/cst-visit.js
var require_cst_visit = __commonJS({
  "node_modules/yaml/dist/parse/cst-visit.js"(exports) {
    "use strict";
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove item");
    function visit(cst, visitor) {
      if ("type" in cst && cst.type === "document")
        cst = { start: cst.start, value: cst.value };
      _visit(Object.freeze([]), cst, visitor);
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    visit.itemAtPath = (cst, path) => {
      let item = cst;
      for (const [field, index] of path) {
        const tok = item?.[field];
        if (tok && "items" in tok) {
          item = tok.items[index];
        } else
          return void 0;
      }
      return item;
    };
    visit.parentCollection = (cst, path) => {
      const parent = visit.itemAtPath(cst, path.slice(0, -1));
      const field = path[path.length - 1][0];
      const coll = parent?.[field];
      if (coll && "items" in coll)
        return coll;
      throw new Error("Parent collection not found");
    };
    function _visit(path, item, visitor) {
      let ctrl = visitor(item, path);
      if (typeof ctrl === "symbol")
        return ctrl;
      for (const field of ["key", "value"]) {
        const token = item[field];
        if (token && "items" in token) {
          for (let i = 0; i < token.items.length; ++i) {
            const ci = _visit(Object.freeze(path.concat([[field, i]])), token.items[i], visitor);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              token.items.splice(i, 1);
              i -= 1;
            }
          }
          if (typeof ctrl === "function" && field === "key")
            ctrl = ctrl(item, path);
        }
      }
      return typeof ctrl === "function" ? ctrl(item, path) : ctrl;
    }
    exports.visit = visit;
  }
});

// node_modules/yaml/dist/parse/cst.js
var require_cst = __commonJS({
  "node_modules/yaml/dist/parse/cst.js"(exports) {
    "use strict";
    var cstScalar = require_cst_scalar();
    var cstStringify = require_cst_stringify();
    var cstVisit = require_cst_visit();
    var BOM = "\uFEFF";
    var DOCUMENT = "";
    var FLOW_END = "";
    var SCALAR2 = "";
    var isCollection2 = (token) => !!token && "items" in token;
    var isScalar4 = (token) => !!token && (token.type === "scalar" || token.type === "single-quoted-scalar" || token.type === "double-quoted-scalar" || token.type === "block-scalar");
    function prettyToken(token) {
      switch (token) {
        case BOM:
          return "<BOM>";
        case DOCUMENT:
          return "<DOC>";
        case FLOW_END:
          return "<FLOW_END>";
        case SCALAR2:
          return "<SCALAR>";
        default:
          return JSON.stringify(token);
      }
    }
    function tokenType(source) {
      switch (source) {
        case BOM:
          return "byte-order-mark";
        case DOCUMENT:
          return "doc-mode";
        case FLOW_END:
          return "flow-error-end";
        case SCALAR2:
          return "scalar";
        case "---":
          return "doc-start";
        case "...":
          return "doc-end";
        case "":
        case "\n":
        case "\r\n":
          return "newline";
        case "-":
          return "seq-item-ind";
        case "?":
          return "explicit-key-ind";
        case ":":
          return "map-value-ind";
        case "{":
          return "flow-map-start";
        case "}":
          return "flow-map-end";
        case "[":
          return "flow-seq-start";
        case "]":
          return "flow-seq-end";
        case ",":
          return "comma";
      }
      switch (source[0]) {
        case " ":
        case "	":
          return "space";
        case "#":
          return "comment";
        case "%":
          return "directive-line";
        case "*":
          return "alias";
        case "&":
          return "anchor";
        case "!":
          return "tag";
        case "'":
          return "single-quoted-scalar";
        case '"':
          return "double-quoted-scalar";
        case "|":
        case ">":
          return "block-scalar-header";
      }
      return null;
    }
    exports.createScalarToken = cstScalar.createScalarToken;
    exports.resolveAsScalar = cstScalar.resolveAsScalar;
    exports.setScalarValue = cstScalar.setScalarValue;
    exports.stringify = cstStringify.stringify;
    exports.visit = cstVisit.visit;
    exports.BOM = BOM;
    exports.DOCUMENT = DOCUMENT;
    exports.FLOW_END = FLOW_END;
    exports.SCALAR = SCALAR2;
    exports.isCollection = isCollection2;
    exports.isScalar = isScalar4;
    exports.prettyToken = prettyToken;
    exports.tokenType = tokenType;
  }
});

// node_modules/yaml/dist/parse/lexer.js
var require_lexer = __commonJS({
  "node_modules/yaml/dist/parse/lexer.js"(exports) {
    "use strict";
    var cst = require_cst();
    function isEmpty(ch) {
      switch (ch) {
        case void 0:
        case " ":
        case "\n":
        case "\r":
        case "	":
          return true;
        default:
          return false;
      }
    }
    var hexDigits = new Set("0123456789ABCDEFabcdef");
    var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
    var flowIndicatorChars = new Set(",[]{}");
    var invalidAnchorChars = new Set(" ,[]{}\n\r	");
    var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
    var Lexer2 = class {
      constructor() {
        this.atEnd = false;
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        this.buffer = "";
        this.flowKey = false;
        this.flowLevel = 0;
        this.indentNext = 0;
        this.indentValue = 0;
        this.lineEndPos = null;
        this.next = null;
        this.pos = 0;
      }
      /**
       * Generate YAML tokens from the `source` string. If `incomplete`,
       * a part of the last line may be left as a buffer for the next call.
       *
       * @returns A generator of lexical tokens
       */
      *lex(source, incomplete = false) {
        if (source) {
          if (typeof source !== "string")
            throw TypeError("source is not a string");
          this.buffer = this.buffer ? this.buffer + source : source;
          this.lineEndPos = null;
        }
        this.atEnd = !incomplete;
        let next = this.next ?? "stream";
        while (next && (incomplete || this.hasChars(1)))
          next = yield* this.parseNext(next);
      }
      atLineEnd() {
        let i = this.pos;
        let ch = this.buffer[i];
        while (ch === " " || ch === "	")
          ch = this.buffer[++i];
        if (!ch || ch === "#" || ch === "\n")
          return true;
        if (ch === "\r")
          return this.buffer[i + 1] === "\n";
        return false;
      }
      charAt(n) {
        return this.buffer[this.pos + n];
      }
      continueScalar(offset) {
        let ch = this.buffer[offset];
        if (this.indentNext > 0) {
          let indent = 0;
          while (ch === " ")
            ch = this.buffer[++indent + offset];
          if (ch === "\r") {
            const next = this.buffer[indent + offset + 1];
            if (next === "\n" || !next && !this.atEnd)
              return offset + indent + 1;
          }
          return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
        }
        if (ch === "-" || ch === ".") {
          const dt = this.buffer.substr(offset, 3);
          if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
            return -1;
        }
        return offset;
      }
      getLine() {
        let end = this.lineEndPos;
        if (typeof end !== "number" || end !== -1 && end < this.pos) {
          end = this.buffer.indexOf("\n", this.pos);
          this.lineEndPos = end;
        }
        if (end === -1)
          return this.atEnd ? this.buffer.substring(this.pos) : null;
        if (this.buffer[end - 1] === "\r")
          end -= 1;
        return this.buffer.substring(this.pos, end);
      }
      hasChars(n) {
        return this.pos + n <= this.buffer.length;
      }
      setNext(state) {
        this.buffer = this.buffer.substring(this.pos);
        this.pos = 0;
        this.lineEndPos = null;
        this.next = state;
        return null;
      }
      peek(n) {
        return this.buffer.substr(this.pos, n);
      }
      *parseNext(next) {
        switch (next) {
          case "stream":
            return yield* this.parseStream();
          case "line-start":
            return yield* this.parseLineStart();
          case "block-start":
            return yield* this.parseBlockStart();
          case "doc":
            return yield* this.parseDocument();
          case "flow":
            return yield* this.parseFlowCollection();
          case "quoted-scalar":
            return yield* this.parseQuotedScalar();
          case "block-scalar":
            return yield* this.parseBlockScalar();
          case "plain-scalar":
            return yield* this.parsePlainScalar();
        }
      }
      *parseStream() {
        let line = this.getLine();
        if (line === null)
          return this.setNext("stream");
        if (line[0] === cst.BOM) {
          yield* this.pushCount(1);
          line = line.substring(1);
        }
        if (line[0] === "%") {
          let dirEnd = line.length;
          let cs = line.indexOf("#");
          while (cs !== -1) {
            const ch = line[cs - 1];
            if (ch === " " || ch === "	") {
              dirEnd = cs - 1;
              break;
            } else {
              cs = line.indexOf("#", cs + 1);
            }
          }
          while (true) {
            const ch = line[dirEnd - 1];
            if (ch === " " || ch === "	")
              dirEnd -= 1;
            else
              break;
          }
          const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
          yield* this.pushCount(line.length - n);
          this.pushNewline();
          return "stream";
        }
        if (this.atLineEnd()) {
          const sp = yield* this.pushSpaces(true);
          yield* this.pushCount(line.length - sp);
          yield* this.pushNewline();
          return "stream";
        }
        yield cst.DOCUMENT;
        return yield* this.parseLineStart();
      }
      *parseLineStart() {
        const ch = this.charAt(0);
        if (!ch && !this.atEnd)
          return this.setNext("line-start");
        if (ch === "-" || ch === ".") {
          if (!this.atEnd && !this.hasChars(4))
            return this.setNext("line-start");
          const s = this.peek(3);
          if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
            yield* this.pushCount(3);
            this.indentValue = 0;
            this.indentNext = 0;
            return s === "---" ? "doc" : "stream";
          }
        }
        this.indentValue = yield* this.pushSpaces(false);
        if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
          this.indentNext = this.indentValue;
        return yield* this.parseBlockStart();
      }
      *parseBlockStart() {
        const [ch0, ch1] = this.peek(2);
        if (!ch1 && !this.atEnd)
          return this.setNext("block-start");
        if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
          const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
          this.indentNext = this.indentValue + 1;
          this.indentValue += n;
          return "block-start";
        }
        return "doc";
      }
      *parseDocument() {
        yield* this.pushSpaces(true);
        const line = this.getLine();
        if (line === null)
          return this.setNext("doc");
        let n = yield* this.pushIndicators();
        switch (line[n]) {
          case "#":
            yield* this.pushCount(line.length - n);
          // fallthrough
          case void 0:
            yield* this.pushNewline();
            return yield* this.parseLineStart();
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel = 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            return "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "doc";
          case '"':
          case "'":
            return yield* this.parseQuotedScalar();
          case "|":
          case ">":
            n += yield* this.parseBlockScalarHeader();
            n += yield* this.pushSpaces(true);
            yield* this.pushCount(line.length - n);
            yield* this.pushNewline();
            return yield* this.parseBlockScalar();
          default:
            return yield* this.parsePlainScalar();
        }
      }
      *parseFlowCollection() {
        let nl, sp;
        let indent = -1;
        do {
          nl = yield* this.pushNewline();
          if (nl > 0) {
            sp = yield* this.pushSpaces(false);
            this.indentValue = indent = sp;
          } else {
            sp = 0;
          }
          sp += yield* this.pushSpaces(true);
        } while (nl + sp > 0);
        const line = this.getLine();
        if (line === null)
          return this.setNext("flow");
        if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
          const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
          if (!atFlowEndMarker) {
            this.flowLevel = 0;
            yield cst.FLOW_END;
            return yield* this.parseLineStart();
          }
        }
        let n = 0;
        while (line[n] === ",") {
          n += yield* this.pushCount(1);
          n += yield* this.pushSpaces(true);
          this.flowKey = false;
        }
        n += yield* this.pushIndicators();
        switch (line[n]) {
          case void 0:
            return "flow";
          case "#":
            yield* this.pushCount(line.length - n);
            return "flow";
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel += 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            this.flowKey = true;
            this.flowLevel -= 1;
            return this.flowLevel ? "flow" : "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "flow";
          case '"':
          case "'":
            this.flowKey = true;
            return yield* this.parseQuotedScalar();
          case ":": {
            const next = this.charAt(1);
            if (this.flowKey || isEmpty(next) || next === ",") {
              this.flowKey = false;
              yield* this.pushCount(1);
              yield* this.pushSpaces(true);
              return "flow";
            }
          }
          // fallthrough
          default:
            this.flowKey = false;
            return yield* this.parsePlainScalar();
        }
      }
      *parseQuotedScalar() {
        const quote = this.charAt(0);
        let end = this.buffer.indexOf(quote, this.pos + 1);
        if (quote === "'") {
          while (end !== -1 && this.buffer[end + 1] === "'")
            end = this.buffer.indexOf("'", end + 2);
        } else {
          while (end !== -1) {
            let n = 0;
            while (this.buffer[end - 1 - n] === "\\")
              n += 1;
            if (n % 2 === 0)
              break;
            end = this.buffer.indexOf('"', end + 1);
          }
        }
        const qb = this.buffer.substring(0, end);
        let nl = qb.indexOf("\n", this.pos);
        if (nl !== -1) {
          while (nl !== -1) {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = qb.indexOf("\n", cs);
          }
          if (nl !== -1) {
            end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
          }
        }
        if (end === -1) {
          if (!this.atEnd)
            return this.setNext("quoted-scalar");
          end = this.buffer.length;
        }
        yield* this.pushToIndex(end + 1, false);
        return this.flowLevel ? "flow" : "doc";
      }
      *parseBlockScalarHeader() {
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        let i = this.pos;
        while (true) {
          const ch = this.buffer[++i];
          if (ch === "+")
            this.blockScalarKeep = true;
          else if (ch > "0" && ch <= "9")
            this.blockScalarIndent = Number(ch) - 1;
          else if (ch !== "-")
            break;
        }
        return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
      }
      *parseBlockScalar() {
        let nl = this.pos - 1;
        let indent = 0;
        let ch;
        loop: for (let i2 = this.pos; ch = this.buffer[i2]; ++i2) {
          switch (ch) {
            case " ":
              indent += 1;
              break;
            case "\n":
              nl = i2;
              indent = 0;
              break;
            case "\r": {
              const next = this.buffer[i2 + 1];
              if (!next && !this.atEnd)
                return this.setNext("block-scalar");
              if (next === "\n")
                break;
            }
            // fallthrough
            default:
              break loop;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("block-scalar");
        if (indent >= this.indentNext) {
          if (this.blockScalarIndent === -1)
            this.indentNext = indent;
          else {
            this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
          }
          do {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = this.buffer.indexOf("\n", cs);
          } while (nl !== -1);
          if (nl === -1) {
            if (!this.atEnd)
              return this.setNext("block-scalar");
            nl = this.buffer.length;
          }
        }
        let i = nl + 1;
        ch = this.buffer[i];
        while (ch === " ")
          ch = this.buffer[++i];
        if (ch === "	") {
          while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
            ch = this.buffer[++i];
          nl = i - 1;
        } else if (!this.blockScalarKeep) {
          do {
            let i2 = nl - 1;
            let ch2 = this.buffer[i2];
            if (ch2 === "\r")
              ch2 = this.buffer[--i2];
            const lastChar = i2;
            while (ch2 === " ")
              ch2 = this.buffer[--i2];
            if (ch2 === "\n" && i2 >= this.pos && i2 + 1 + indent > lastChar)
              nl = i2;
            else
              break;
          } while (true);
        }
        yield cst.SCALAR;
        yield* this.pushToIndex(nl + 1, true);
        return yield* this.parseLineStart();
      }
      *parsePlainScalar() {
        const inFlow = this.flowLevel > 0;
        let end = this.pos - 1;
        let i = this.pos - 1;
        let ch;
        while (ch = this.buffer[++i]) {
          if (ch === ":") {
            const next = this.buffer[i + 1];
            if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
              break;
            end = i;
          } else if (isEmpty(ch)) {
            let next = this.buffer[i + 1];
            if (ch === "\r") {
              if (next === "\n") {
                i += 1;
                ch = "\n";
                next = this.buffer[i + 1];
              } else
                end = i;
            }
            if (next === "#" || inFlow && flowIndicatorChars.has(next))
              break;
            if (ch === "\n") {
              const cs = this.continueScalar(i + 1);
              if (cs === -1)
                break;
              i = Math.max(i, cs - 2);
            }
          } else {
            if (inFlow && flowIndicatorChars.has(ch))
              break;
            end = i;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("plain-scalar");
        yield cst.SCALAR;
        yield* this.pushToIndex(end + 1, true);
        return inFlow ? "flow" : "doc";
      }
      *pushCount(n) {
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos += n;
          return n;
        }
        return 0;
      }
      *pushToIndex(i, allowEmpty) {
        const s = this.buffer.slice(this.pos, i);
        if (s) {
          yield s;
          this.pos += s.length;
          return s.length;
        } else if (allowEmpty)
          yield "";
        return 0;
      }
      *pushIndicators() {
        let n = 0;
        loop: while (true) {
          switch (this.charAt(0)) {
            case "!":
              n += yield* this.pushTag();
              n += yield* this.pushSpaces(true);
              continue loop;
            case "&":
              n += yield* this.pushUntil(isNotAnchorChar);
              n += yield* this.pushSpaces(true);
              continue loop;
            case "-":
            // this is an error
            case "?":
            // this is an error outside flow collections
            case ":": {
              const inFlow = this.flowLevel > 0;
              const ch1 = this.charAt(1);
              if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
                if (!inFlow)
                  this.indentNext = this.indentValue + 1;
                else if (this.flowKey)
                  this.flowKey = false;
                n += yield* this.pushCount(1);
                n += yield* this.pushSpaces(true);
                continue loop;
              }
            }
          }
          break loop;
        }
        return n;
      }
      *pushTag() {
        if (this.charAt(1) === "<") {
          let i = this.pos + 2;
          let ch = this.buffer[i];
          while (!isEmpty(ch) && ch !== ">")
            ch = this.buffer[++i];
          return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
        } else {
          let i = this.pos + 1;
          let ch = this.buffer[i];
          while (ch) {
            if (tagChars.has(ch))
              ch = this.buffer[++i];
            else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
              ch = this.buffer[i += 3];
            } else
              break;
          }
          return yield* this.pushToIndex(i, false);
        }
      }
      *pushNewline() {
        const ch = this.buffer[this.pos];
        if (ch === "\n")
          return yield* this.pushCount(1);
        else if (ch === "\r" && this.charAt(1) === "\n")
          return yield* this.pushCount(2);
        else
          return 0;
      }
      *pushSpaces(allowTabs) {
        let i = this.pos - 1;
        let ch;
        do {
          ch = this.buffer[++i];
        } while (ch === " " || allowTabs && ch === "	");
        const n = i - this.pos;
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos = i;
        }
        return n;
      }
      *pushUntil(test) {
        let i = this.pos;
        let ch = this.buffer[i];
        while (!test(ch))
          ch = this.buffer[++i];
        return yield* this.pushToIndex(i, false);
      }
    };
    exports.Lexer = Lexer2;
  }
});

// node_modules/yaml/dist/parse/line-counter.js
var require_line_counter = __commonJS({
  "node_modules/yaml/dist/parse/line-counter.js"(exports) {
    "use strict";
    var LineCounter3 = class {
      constructor() {
        this.lineStarts = [];
        this.addNewLine = (offset) => this.lineStarts.push(offset);
        this.linePos = (offset) => {
          let low = 0;
          let high = this.lineStarts.length;
          while (low < high) {
            const mid = low + high >> 1;
            if (this.lineStarts[mid] < offset)
              low = mid + 1;
            else
              high = mid;
          }
          if (this.lineStarts[low] === offset)
            return { line: low + 1, col: 1 };
          if (low === 0)
            return { line: 0, col: offset };
          const start = this.lineStarts[low - 1];
          return { line: low, col: offset - start + 1 };
        };
      }
    };
    exports.LineCounter = LineCounter3;
  }
});

// node_modules/yaml/dist/parse/parser.js
var require_parser = __commonJS({
  "node_modules/yaml/dist/parse/parser.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var cst = require_cst();
    var lexer = require_lexer();
    function includesToken(list, type) {
      for (let i = 0; i < list.length; ++i)
        if (list[i].type === type)
          return true;
      return false;
    }
    function findNonEmptyIndex(list) {
      for (let i = 0; i < list.length; ++i) {
        switch (list[i].type) {
          case "space":
          case "comment":
          case "newline":
            break;
          default:
            return i;
        }
      }
      return -1;
    }
    function isFlowToken(token) {
      switch (token?.type) {
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "flow-collection":
          return true;
        default:
          return false;
      }
    }
    function getPrevProps(parent) {
      switch (parent.type) {
        case "document":
          return parent.start;
        case "block-map": {
          const it = parent.items[parent.items.length - 1];
          return it.sep ?? it.start;
        }
        case "block-seq":
          return parent.items[parent.items.length - 1].start;
        /* istanbul ignore next should not happen */
        default:
          return [];
      }
    }
    function getFirstKeyStartProps(prev) {
      if (prev.length === 0)
        return [];
      let i = prev.length;
      loop: while (--i >= 0) {
        switch (prev[i].type) {
          case "doc-start":
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
          case "newline":
            break loop;
        }
      }
      while (prev[++i]?.type === "space") {
      }
      return prev.splice(i, prev.length);
    }
    function arrayPushArray(target, source) {
      if (source.length < 1e5)
        Array.prototype.push.apply(target, source);
      else
        for (let i = 0; i < source.length; ++i)
          target.push(source[i]);
    }
    function fixFlowSeqItems(fc) {
      if (fc.start.type === "flow-seq-start") {
        for (const it of fc.items) {
          if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
            if (it.key)
              it.value = it.key;
            delete it.key;
            if (isFlowToken(it.value)) {
              if (it.value.end)
                arrayPushArray(it.value.end, it.sep);
              else
                it.value.end = it.sep;
            } else
              arrayPushArray(it.start, it.sep);
            delete it.sep;
          }
        }
      }
    }
    var Parser2 = class {
      /**
       * @param onNewLine - If defined, called separately with the start position of
       *   each new line (in `parse()`, including the start of input).
       */
      constructor(onNewLine) {
        this.atNewLine = true;
        this.atScalar = false;
        this.indent = 0;
        this.offset = 0;
        this.onKeyLine = false;
        this.stack = [];
        this.source = "";
        this.type = "";
        this.lexer = new lexer.Lexer();
        this.onNewLine = onNewLine;
      }
      /**
       * Parse `source` as a YAML stream.
       * If `incomplete`, a part of the last line may be left as a buffer for the next call.
       *
       * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
       *
       * @returns A generator of tokens representing each directive, document, and other structure.
       */
      *parse(source, incomplete = false) {
        if (this.onNewLine && this.offset === 0)
          this.onNewLine(0);
        for (const lexeme of this.lexer.lex(source, incomplete))
          yield* this.next(lexeme);
        if (!incomplete)
          yield* this.end();
      }
      /**
       * Advance the parser by the `source` of one lexical token.
       */
      *next(source) {
        this.source = source;
        if (node_process.env.LOG_TOKENS)
          console.log("|", cst.prettyToken(source));
        if (this.atScalar) {
          this.atScalar = false;
          yield* this.step();
          this.offset += source.length;
          return;
        }
        const type = cst.tokenType(source);
        if (!type) {
          const message = `Not a YAML token: ${source}`;
          yield* this.pop({ type: "error", offset: this.offset, message, source });
          this.offset += source.length;
        } else if (type === "scalar") {
          this.atNewLine = false;
          this.atScalar = true;
          this.type = "scalar";
        } else {
          this.type = type;
          yield* this.step();
          switch (type) {
            case "newline":
              this.atNewLine = true;
              this.indent = 0;
              if (this.onNewLine)
                this.onNewLine(this.offset + source.length);
              break;
            case "space":
              if (this.atNewLine && source[0] === " ")
                this.indent += source.length;
              break;
            case "explicit-key-ind":
            case "map-value-ind":
            case "seq-item-ind":
              if (this.atNewLine)
                this.indent += source.length;
              break;
            case "doc-mode":
            case "flow-error-end":
              return;
            default:
              this.atNewLine = false;
          }
          this.offset += source.length;
        }
      }
      /** Call at end of input to push out any remaining constructions */
      *end() {
        while (this.stack.length > 0)
          yield* this.pop();
      }
      get sourceToken() {
        const st = {
          type: this.type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
        return st;
      }
      *step() {
        const top = this.peek(1);
        if (this.type === "doc-end" && top?.type !== "doc-end") {
          while (this.stack.length > 0)
            yield* this.pop();
          this.stack.push({
            type: "doc-end",
            offset: this.offset,
            source: this.source
          });
          return;
        }
        if (!top)
          return yield* this.stream();
        switch (top.type) {
          case "document":
            return yield* this.document(top);
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return yield* this.scalar(top);
          case "block-scalar":
            return yield* this.blockScalar(top);
          case "block-map":
            return yield* this.blockMap(top);
          case "block-seq":
            return yield* this.blockSequence(top);
          case "flow-collection":
            return yield* this.flowCollection(top);
          case "doc-end":
            return yield* this.documentEnd(top);
        }
        yield* this.pop();
      }
      peek(n) {
        return this.stack[this.stack.length - n];
      }
      *pop(error) {
        const token = error ?? this.stack.pop();
        if (!token) {
          const message = "Tried to pop an empty stack";
          yield { type: "error", offset: this.offset, source: "", message };
        } else if (this.stack.length === 0) {
          yield token;
        } else {
          const top = this.peek(1);
          if (token.type === "block-scalar") {
            token.indent = "indent" in top ? top.indent : 0;
          } else if (token.type === "flow-collection" && top.type === "document") {
            token.indent = 0;
          }
          if (token.type === "flow-collection")
            fixFlowSeqItems(token);
          switch (top.type) {
            case "document":
              top.value = token;
              break;
            case "block-scalar":
              top.props.push(token);
              break;
            case "block-map": {
              const it = top.items[top.items.length - 1];
              if (it.value) {
                top.items.push({ start: [], key: token, sep: [] });
                this.onKeyLine = true;
                return;
              } else if (it.sep) {
                it.value = token;
              } else {
                Object.assign(it, { key: token, sep: [] });
                this.onKeyLine = !it.explicitKey;
                return;
              }
              break;
            }
            case "block-seq": {
              const it = top.items[top.items.length - 1];
              if (it.value)
                top.items.push({ start: [], value: token });
              else
                it.value = token;
              break;
            }
            case "flow-collection": {
              const it = top.items[top.items.length - 1];
              if (!it || it.value)
                top.items.push({ start: [], key: token, sep: [] });
              else if (it.sep)
                it.value = token;
              else
                Object.assign(it, { key: token, sep: [] });
              return;
            }
            /* istanbul ignore next should not happen */
            default:
              yield* this.pop();
              yield* this.pop(token);
          }
          if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
            const last = token.items[token.items.length - 1];
            if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
              if (top.type === "document")
                top.end = last.start;
              else
                top.items.push({ start: last.start });
              token.items.splice(-1, 1);
            }
          }
        }
      }
      *stream() {
        switch (this.type) {
          case "directive-line":
            yield { type: "directive", offset: this.offset, source: this.source };
            return;
          case "byte-order-mark":
          case "space":
          case "comment":
          case "newline":
            yield this.sourceToken;
            return;
          case "doc-mode":
          case "doc-start": {
            const doc = {
              type: "document",
              offset: this.offset,
              start: []
            };
            if (this.type === "doc-start")
              doc.start.push(this.sourceToken);
            this.stack.push(doc);
            return;
          }
        }
        yield {
          type: "error",
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML stream`,
          source: this.source
        };
      }
      *document(doc) {
        if (doc.value)
          return yield* this.lineEnd(doc);
        switch (this.type) {
          case "doc-start": {
            if (findNonEmptyIndex(doc.start) !== -1) {
              yield* this.pop();
              yield* this.step();
            } else
              doc.start.push(this.sourceToken);
            return;
          }
          case "anchor":
          case "tag":
          case "space":
          case "comment":
          case "newline":
            doc.start.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(doc);
        if (bv)
          this.stack.push(bv);
        else {
          yield {
            type: "error",
            offset: this.offset,
            message: `Unexpected ${this.type} token in YAML document`,
            source: this.source
          };
        }
      }
      *scalar(scalar) {
        if (this.type === "map-value-ind") {
          const prev = getPrevProps(this.peek(2));
          const start = getFirstKeyStartProps(prev);
          let sep;
          if (scalar.end) {
            sep = scalar.end;
            sep.push(this.sourceToken);
            delete scalar.end;
          } else
            sep = [this.sourceToken];
          const map = {
            type: "block-map",
            offset: scalar.offset,
            indent: scalar.indent,
            items: [{ start, key: scalar, sep }]
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map;
        } else
          yield* this.lineEnd(scalar);
      }
      *blockScalar(scalar) {
        switch (this.type) {
          case "space":
          case "comment":
          case "newline":
            scalar.props.push(this.sourceToken);
            return;
          case "scalar":
            scalar.source = this.source;
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine) {
              let nl = this.source.indexOf("\n") + 1;
              while (nl !== 0) {
                this.onNewLine(this.offset + nl);
                nl = this.source.indexOf("\n", nl) + 1;
              }
            }
            yield* this.pop();
            break;
          /* istanbul ignore next should not happen */
          default:
            yield* this.pop();
            yield* this.step();
        }
      }
      *blockMap(map) {
        const it = map.items[map.items.length - 1];
        switch (this.type) {
          case "newline":
            this.onKeyLine = false;
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              it.start.push(this.sourceToken);
            }
            return;
          case "space":
          case "comment":
            if (it.value) {
              map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              if (this.atIndentedComment(it.start, map.indent)) {
                const prev = map.items[map.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  map.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
        }
        if (this.indent >= map.indent) {
          const atMapIndent = !this.onKeyLine && this.indent === map.indent;
          const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
          let start = [];
          if (atNextItem && it.sep && !it.value) {
            const nl = [];
            for (let i = 0; i < it.sep.length; ++i) {
              const st = it.sep[i];
              switch (st.type) {
                case "newline":
                  nl.push(i);
                  break;
                case "space":
                  break;
                case "comment":
                  if (st.indent > map.indent)
                    nl.length = 0;
                  break;
                default:
                  nl.length = 0;
              }
            }
            if (nl.length >= 2)
              start = it.sep.splice(nl[1]);
          }
          switch (this.type) {
            case "anchor":
            case "tag":
              if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start });
                this.onKeyLine = true;
              } else if (it.sep) {
                it.sep.push(this.sourceToken);
              } else {
                it.start.push(this.sourceToken);
              }
              return;
            case "explicit-key-ind":
              if (!it.sep && !it.explicitKey) {
                it.start.push(this.sourceToken);
                it.explicitKey = true;
              } else if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start, explicitKey: true });
              } else {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [this.sourceToken], explicitKey: true }]
                });
              }
              this.onKeyLine = true;
              return;
            case "map-value-ind":
              if (it.explicitKey) {
                if (!it.sep) {
                  if (includesToken(it.start, "newline")) {
                    Object.assign(it, { key: null, sep: [this.sourceToken] });
                  } else {
                    const start2 = getFirstKeyStartProps(it.start);
                    this.stack.push({
                      type: "block-map",
                      offset: this.offset,
                      indent: this.indent,
                      items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                    });
                  }
                } else if (it.value) {
                  map.items.push({ start: [], key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start, key: null, sep: [this.sourceToken] }]
                  });
                } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
                  const start2 = getFirstKeyStartProps(it.start);
                  const key = it.key;
                  const sep = it.sep;
                  sep.push(this.sourceToken);
                  delete it.key;
                  delete it.sep;
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key, sep }]
                  });
                } else if (start.length > 0) {
                  it.sep = it.sep.concat(start, this.sourceToken);
                } else {
                  it.sep.push(this.sourceToken);
                }
              } else {
                if (!it.sep) {
                  Object.assign(it, { key: null, sep: [this.sourceToken] });
                } else if (it.value || atNextItem) {
                  map.items.push({ start, key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: [], key: null, sep: [this.sourceToken] }]
                  });
                } else {
                  it.sep.push(this.sourceToken);
                }
              }
              this.onKeyLine = true;
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (atNextItem || it.value) {
                map.items.push({ start, key: fs, sep: [] });
                this.onKeyLine = true;
              } else if (it.sep) {
                this.stack.push(fs);
              } else {
                Object.assign(it, { key: fs, sep: [] });
                this.onKeyLine = true;
              }
              return;
            }
            default: {
              const bv = this.startBlockValue(map);
              if (bv) {
                if (bv.type === "block-seq") {
                  if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                    yield* this.pop({
                      type: "error",
                      offset: this.offset,
                      message: "Unexpected block-seq-ind on same line with key",
                      source: this.source
                    });
                    return;
                  }
                } else if (atMapIndent) {
                  map.items.push({ start });
                }
                this.stack.push(bv);
                return;
              }
            }
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *blockSequence(seq) {
        const it = seq.items[seq.items.length - 1];
        switch (this.type) {
          case "newline":
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                seq.items.push({ start: [this.sourceToken] });
            } else
              it.start.push(this.sourceToken);
            return;
          case "space":
          case "comment":
            if (it.value)
              seq.items.push({ start: [this.sourceToken] });
            else {
              if (this.atIndentedComment(it.start, seq.indent)) {
                const prev = seq.items[seq.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  seq.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
          case "anchor":
          case "tag":
            if (it.value || this.indent <= seq.indent)
              break;
            it.start.push(this.sourceToken);
            return;
          case "seq-item-ind":
            if (this.indent !== seq.indent)
              break;
            if (it.value || includesToken(it.start, "seq-item-ind"))
              seq.items.push({ start: [this.sourceToken] });
            else
              it.start.push(this.sourceToken);
            return;
        }
        if (this.indent > seq.indent) {
          const bv = this.startBlockValue(seq);
          if (bv) {
            this.stack.push(bv);
            return;
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *flowCollection(fc) {
        const it = fc.items[fc.items.length - 1];
        if (this.type === "flow-error-end") {
          let top;
          do {
            yield* this.pop();
            top = this.peek(1);
          } while (top?.type === "flow-collection");
        } else if (fc.end.length === 0) {
          switch (this.type) {
            case "comma":
            case "explicit-key-ind":
              if (!it || it.sep)
                fc.items.push({ start: [this.sourceToken] });
              else
                it.start.push(this.sourceToken);
              return;
            case "map-value-ind":
              if (!it || it.value)
                fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              return;
            case "space":
            case "comment":
            case "newline":
            case "anchor":
            case "tag":
              if (!it || it.value)
                fc.items.push({ start: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                it.start.push(this.sourceToken);
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (!it || it.value)
                fc.items.push({ start: [], key: fs, sep: [] });
              else if (it.sep)
                this.stack.push(fs);
              else
                Object.assign(it, { key: fs, sep: [] });
              return;
            }
            case "flow-map-end":
            case "flow-seq-end":
              fc.end.push(this.sourceToken);
              return;
          }
          const bv = this.startBlockValue(fc);
          if (bv)
            this.stack.push(bv);
          else {
            yield* this.pop();
            yield* this.step();
          }
        } else {
          const parent = this.peek(2);
          if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
            yield* this.pop();
            yield* this.step();
          } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            fixFlowSeqItems(fc);
            const sep = fc.end.splice(1, fc.end.length);
            sep.push(this.sourceToken);
            const map = {
              type: "block-map",
              offset: fc.offset,
              indent: fc.indent,
              items: [{ start, key: fc, sep }]
            };
            this.onKeyLine = true;
            this.stack[this.stack.length - 1] = map;
          } else {
            yield* this.lineEnd(fc);
          }
        }
      }
      flowScalar(type) {
        if (this.onNewLine) {
          let nl = this.source.indexOf("\n") + 1;
          while (nl !== 0) {
            this.onNewLine(this.offset + nl);
            nl = this.source.indexOf("\n", nl) + 1;
          }
        }
        return {
          type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
      }
      startBlockValue(parent) {
        switch (this.type) {
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return this.flowScalar(this.type);
          case "block-scalar-header":
            return {
              type: "block-scalar",
              offset: this.offset,
              indent: this.indent,
              props: [this.sourceToken],
              source: ""
            };
          case "flow-map-start":
          case "flow-seq-start":
            return {
              type: "flow-collection",
              offset: this.offset,
              indent: this.indent,
              start: this.sourceToken,
              items: [],
              end: []
            };
          case "seq-item-ind":
            return {
              type: "block-seq",
              offset: this.offset,
              indent: this.indent,
              items: [{ start: [this.sourceToken] }]
            };
          case "explicit-key-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            start.push(this.sourceToken);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, explicitKey: true }]
            };
          }
          case "map-value-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, key: null, sep: [this.sourceToken] }]
            };
          }
        }
        return null;
      }
      atIndentedComment(start, indent) {
        if (this.type !== "comment")
          return false;
        if (this.indent <= indent)
          return false;
        return start.every((st) => st.type === "newline" || st.type === "space");
      }
      *documentEnd(docEnd) {
        if (this.type !== "doc-mode") {
          if (docEnd.end)
            docEnd.end.push(this.sourceToken);
          else
            docEnd.end = [this.sourceToken];
          if (this.type === "newline")
            yield* this.pop();
        }
      }
      *lineEnd(token) {
        switch (this.type) {
          case "comma":
          case "doc-start":
          case "doc-end":
          case "flow-seq-end":
          case "flow-map-end":
          case "map-value-ind":
            yield* this.pop();
            yield* this.step();
            break;
          case "newline":
            this.onKeyLine = false;
          // fallthrough
          case "space":
          case "comment":
          default:
            if (token.end)
              token.end.push(this.sourceToken);
            else
              token.end = [this.sourceToken];
            if (this.type === "newline")
              yield* this.pop();
        }
      }
    };
    exports.Parser = Parser2;
  }
});

// node_modules/yaml/dist/public-api.js
var require_public_api = __commonJS({
  "node_modules/yaml/dist/public-api.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var errors = require_errors();
    var log = require_log();
    var identity = require_identity();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    function parseOptions(options) {
      const prettyErrors = options.prettyErrors !== false;
      const lineCounter$1 = options.lineCounter || prettyErrors && new lineCounter.LineCounter() || null;
      return { lineCounter: lineCounter$1, prettyErrors };
    }
    function parseAllDocuments(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      const docs = Array.from(composer$1.compose(parser$1.parse(source)));
      if (prettyErrors && lineCounter2)
        for (const doc of docs) {
          doc.errors.forEach(errors.prettifyError(source, lineCounter2));
          doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
        }
      if (docs.length > 0)
        return docs;
      return Object.assign([], { empty: true }, composer$1.streamInfo());
    }
    function parseDocument3(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      let doc = null;
      for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) {
        if (!doc)
          doc = _doc;
        else if (doc.options.logLevel !== "silent") {
          doc.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
          break;
        }
      }
      if (prettyErrors && lineCounter2) {
        doc.errors.forEach(errors.prettifyError(source, lineCounter2));
        doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
      }
      return doc;
    }
    function parse(src, reviver2, options) {
      let _reviver = void 0;
      if (typeof reviver2 === "function") {
        _reviver = reviver2;
      } else if (options === void 0 && reviver2 && typeof reviver2 === "object") {
        options = reviver2;
      }
      const doc = parseDocument3(src, options);
      if (!doc)
        return null;
      doc.warnings.forEach((warning) => log.warn(doc.options.logLevel, warning));
      if (doc.errors.length > 0) {
        if (doc.options.logLevel !== "silent")
          throw doc.errors[0];
        else
          doc.errors = [];
      }
      return doc.toJS(Object.assign({ reviver: _reviver }, options));
    }
    function stringify(value, replacer2, options) {
      let _replacer = null;
      if (typeof replacer2 === "function" || Array.isArray(replacer2)) {
        _replacer = replacer2;
      } else if (options === void 0 && replacer2) {
        options = replacer2;
      }
      if (typeof options === "string")
        options = options.length;
      if (typeof options === "number") {
        const indent = Math.round(options);
        options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
      }
      if (value === void 0) {
        const { keepUndefined } = options ?? replacer2 ?? {};
        if (!keepUndefined)
          return void 0;
      }
      if (identity.isDocument(value) && !_replacer)
        return value.toString(options);
      return new Document.Document(value, _replacer, options).toString(options);
    }
    exports.parse = parse;
    exports.parseAllDocuments = parseAllDocuments;
    exports.parseDocument = parseDocument3;
    exports.stringify = stringify;
  }
});

// node_modules/yaml/dist/index.js
var require_dist = __commonJS({
  "node_modules/yaml/dist/index.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var Schema = require_Schema();
    var errors = require_errors();
    var Alias = require_Alias();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var cst = require_cst();
    var lexer = require_lexer();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    var publicApi = require_public_api();
    var visit = require_visit();
    exports.Composer = composer.Composer;
    exports.Document = Document.Document;
    exports.Schema = Schema.Schema;
    exports.YAMLError = errors.YAMLError;
    exports.YAMLParseError = errors.YAMLParseError;
    exports.YAMLWarning = errors.YAMLWarning;
    exports.Alias = Alias.Alias;
    exports.isAlias = identity.isAlias;
    exports.isCollection = identity.isCollection;
    exports.isDocument = identity.isDocument;
    exports.isMap = identity.isMap;
    exports.isNode = identity.isNode;
    exports.isPair = identity.isPair;
    exports.isScalar = identity.isScalar;
    exports.isSeq = identity.isSeq;
    exports.Pair = Pair.Pair;
    exports.Scalar = Scalar.Scalar;
    exports.YAMLMap = YAMLMap.YAMLMap;
    exports.YAMLSeq = YAMLSeq.YAMLSeq;
    exports.CST = cst;
    exports.Lexer = lexer.Lexer;
    exports.LineCounter = lineCounter.LineCounter;
    exports.Parser = parser.Parser;
    exports.parse = publicApi.parse;
    exports.parseAllDocuments = publicApi.parseAllDocuments;
    exports.parseDocument = publicApi.parseDocument;
    exports.stringify = publicApi.stringify;
    exports.visit = visit.visit;
    exports.visitAsync = visit.visitAsync;
  }
});

// node_modules/cronstrue/dist/cronstrue.js
var require_cronstrue = __commonJS({
  "node_modules/cronstrue/dist/cronstrue.js"(exports, module) {
    (function webpackUniversalModuleDefinition(root, factory) {
      if (typeof exports === "object" && typeof module === "object")
        module.exports = factory();
      else if (typeof define === "function" && define.amd)
        define("cronstrue", [], factory);
      else if (typeof exports === "object")
        exports["cronstrue"] = factory();
      else
        root["cronstrue"] = factory();
    })(globalThis, () => {
      return (
        /******/
        (() => {
          "use strict";
          var __webpack_modules__ = {
            /***/
            949: (
              /***/
              ((__unused_webpack_module, exports2, __webpack_require__2) => {
                Object.defineProperty(exports2, "__esModule", { value: true });
                exports2.CronParser = void 0;
                var rangeValidator_1 = __webpack_require__2(515);
                var CronParser = (function() {
                  function CronParser2(expression, dayOfWeekStartIndexZero, monthStartIndexZero) {
                    if (dayOfWeekStartIndexZero === void 0) {
                      dayOfWeekStartIndexZero = true;
                    }
                    if (monthStartIndexZero === void 0) {
                      monthStartIndexZero = false;
                    }
                    this.expression = expression;
                    this.dayOfWeekStartIndexZero = dayOfWeekStartIndexZero;
                    this.monthStartIndexZero = monthStartIndexZero;
                  }
                  CronParser2.prototype.parse = function() {
                    var _a;
                    var parsed;
                    var expression = (_a = this.expression) !== null && _a !== void 0 ? _a : "";
                    if (expression.startsWith("@")) {
                      var special = this.parseSpecial(this.expression);
                      parsed = this.extractParts(special);
                    } else {
                      parsed = this.extractParts(this.expression);
                    }
                    this.normalize(parsed);
                    this.validate(parsed);
                    return parsed;
                  };
                  CronParser2.prototype.parseSpecial = function(expression) {
                    var specialExpressions = {
                      "@yearly": "0 0 1 1 *",
                      "@annually": "0 0 1 1 *",
                      "@monthly": "0 0 1 * *",
                      "@weekly": "0 0 * * 0",
                      "@daily": "0 0 * * *",
                      "@midnight": "0 0 * * *",
                      "@hourly": "0 * * * *"
                    };
                    var special = specialExpressions[expression];
                    if (!special) {
                      throw new Error("Unknown special expression.");
                    }
                    return special;
                  };
                  CronParser2.prototype.extractParts = function(expression) {
                    if (!this.expression) {
                      throw new Error("cron expression is empty");
                    }
                    var parsed = expression.trim().split(/[ ]+/);
                    for (var i = 0; i < parsed.length; i++) {
                      if (parsed[i].includes(",")) {
                        var arrayElement = parsed[i].split(",").map(function(item) {
                          return item.trim();
                        }).filter(function(item) {
                          return item !== "";
                        }).map(function(item) {
                          return !isNaN(Number(item)) ? Number(item) : item;
                        }).filter(function(item) {
                          return item !== null && item !== "";
                        });
                        if (arrayElement.length === 0) {
                          arrayElement.push("*");
                        }
                        arrayElement.sort(function(a, b) {
                          return a !== null && b !== null ? a - b : 0;
                        });
                        parsed[i] = arrayElement.map(function(item) {
                          return item !== null ? item.toString() : "";
                        }).join(",");
                      }
                    }
                    if (parsed.length < 5) {
                      throw new Error("Expression has only ".concat(parsed.length, " part").concat(parsed.length == 1 ? "" : "s", ". At least 5 parts are required."));
                    } else if (parsed.length == 5) {
                      parsed.unshift("");
                      parsed.push("");
                    } else if (parsed.length == 6) {
                      var isYearWithNoSecondsPart = /\d{4}$/.test(parsed[5]) || parsed[4] == "?" || parsed[2] == "?";
                      if (isYearWithNoSecondsPart) {
                        parsed.unshift("");
                      } else {
                        parsed.push("");
                      }
                    } else if (parsed.length > 7) {
                      throw new Error("Expression has ".concat(parsed.length, " parts; too many!"));
                    }
                    return parsed;
                  };
                  CronParser2.prototype.normalize = function(expressionParts) {
                    var _this = this;
                    expressionParts[3] = expressionParts[3].replace("?", "*");
                    expressionParts[5] = expressionParts[5].replace("?", "*");
                    expressionParts[2] = expressionParts[2].replace("?", "*");
                    if (expressionParts[0].indexOf("0/") == 0) {
                      expressionParts[0] = expressionParts[0].replace("0/", "*/");
                    }
                    if (expressionParts[1].indexOf("0/") == 0) {
                      expressionParts[1] = expressionParts[1].replace("0/", "*/");
                    }
                    if (expressionParts[2].indexOf("0/") == 0) {
                      expressionParts[2] = expressionParts[2].replace("0/", "*/");
                    }
                    if (expressionParts[3].indexOf("1/") == 0) {
                      expressionParts[3] = expressionParts[3].replace("1/", "*/");
                    }
                    if (expressionParts[4].indexOf("1/") == 0) {
                      expressionParts[4] = expressionParts[4].replace("1/", "*/");
                    }
                    if (expressionParts[6].indexOf("1/") == 0) {
                      expressionParts[6] = expressionParts[6].replace("1/", "*/");
                    }
                    expressionParts[5] = expressionParts[5].replace(/(^\d)|([^#/\s]\d)/g, function(t) {
                      var dowDigits = t.replace(/\D/, "");
                      var dowDigitsAdjusted = dowDigits;
                      if (_this.dayOfWeekStartIndexZero) {
                        if (dowDigits == "7") {
                          dowDigitsAdjusted = "0";
                        }
                      } else {
                        dowDigitsAdjusted = (parseInt(dowDigits) - 1).toString();
                      }
                      return t.replace(dowDigits, dowDigitsAdjusted);
                    });
                    if (expressionParts[5] == "L") {
                      expressionParts[5] = "6";
                    }
                    if (expressionParts[3] == "?") {
                      expressionParts[3] = "*";
                    }
                    if (expressionParts[3].indexOf("W") > -1 && (expressionParts[3].indexOf(",") > -1 || expressionParts[3].indexOf("-") > -1)) {
                      throw new Error("The 'W' character can be specified only when the day-of-month is a single day, not a range or list of days.");
                    }
                    var days = {
                      SUN: 0,
                      MON: 1,
                      TUE: 2,
                      WED: 3,
                      THU: 4,
                      FRI: 5,
                      SAT: 6
                    };
                    for (var day in days) {
                      expressionParts[5] = expressionParts[5].replace(new RegExp(day, "gi"), days[day].toString());
                    }
                    expressionParts[4] = expressionParts[4].replace(/(^\d{1,2})|([^#/\s]\d{1,2})/g, function(t) {
                      var dowDigits = t.replace(/\D/, "");
                      var dowDigitsAdjusted = dowDigits;
                      if (_this.monthStartIndexZero) {
                        dowDigitsAdjusted = (parseInt(dowDigits) + 1).toString();
                      }
                      return t.replace(dowDigits, dowDigitsAdjusted);
                    });
                    var months = {
                      JAN: 1,
                      FEB: 2,
                      MAR: 3,
                      APR: 4,
                      MAY: 5,
                      JUN: 6,
                      JUL: 7,
                      AUG: 8,
                      SEP: 9,
                      OCT: 10,
                      NOV: 11,
                      DEC: 12
                    };
                    for (var month in months) {
                      expressionParts[4] = expressionParts[4].replace(new RegExp(month, "gi"), months[month].toString());
                    }
                    if (expressionParts[0] == "0") {
                      expressionParts[0] = "";
                    }
                    if (!/\*|\-|\,|\//.test(expressionParts[2]) && (/\*|\//.test(expressionParts[1]) || /\*|\//.test(expressionParts[0]))) {
                      expressionParts[2] += "-".concat(expressionParts[2]);
                    }
                    for (var i = 0; i < expressionParts.length; i++) {
                      if (expressionParts[i].indexOf(",") != -1) {
                        expressionParts[i] = expressionParts[i].split(",").filter(function(str) {
                          return str !== "";
                        }).join(",") || "*";
                      }
                      if (expressionParts[i] == "*/1") {
                        expressionParts[i] = "*";
                      }
                      if (expressionParts[i].indexOf("/") > -1 && !/^\*|\-|\,/.test(expressionParts[i])) {
                        var stepRangeThrough = null;
                        switch (i) {
                          case 4:
                            stepRangeThrough = "12";
                            break;
                          case 5:
                            stepRangeThrough = "6";
                            break;
                          case 6:
                            stepRangeThrough = "9999";
                            break;
                          default:
                            stepRangeThrough = null;
                            break;
                        }
                        if (stepRangeThrough !== null) {
                          var parts = expressionParts[i].split("/");
                          expressionParts[i] = "".concat(parts[0], "-").concat(stepRangeThrough, "/").concat(parts[1]);
                        }
                      }
                    }
                  };
                  CronParser2.prototype.validate = function(parsed) {
                    var standardCronPartCharacters = "0-9,\\-*/";
                    this.validateOnlyExpectedCharactersFound(parsed[0], standardCronPartCharacters);
                    this.validateOnlyExpectedCharactersFound(parsed[1], standardCronPartCharacters);
                    this.validateOnlyExpectedCharactersFound(parsed[2], standardCronPartCharacters);
                    this.validateOnlyExpectedCharactersFound(parsed[3], "0-9,\\-*/LW");
                    this.validateOnlyExpectedCharactersFound(parsed[4], standardCronPartCharacters);
                    this.validateOnlyExpectedCharactersFound(parsed[5], "0-9,\\-*/L#");
                    this.validateOnlyExpectedCharactersFound(parsed[6], standardCronPartCharacters);
                    this.validateAnyRanges(parsed);
                  };
                  CronParser2.prototype.validateAnyRanges = function(parsed) {
                    rangeValidator_1.default.secondRange(parsed[0]);
                    rangeValidator_1.default.minuteRange(parsed[1]);
                    rangeValidator_1.default.hourRange(parsed[2]);
                    rangeValidator_1.default.dayOfMonthRange(parsed[3]);
                    rangeValidator_1.default.monthRange(parsed[4], this.monthStartIndexZero);
                    rangeValidator_1.default.dayOfWeekRange(parsed[5], this.dayOfWeekStartIndexZero);
                  };
                  CronParser2.prototype.validateOnlyExpectedCharactersFound = function(cronPart, allowedCharsExpression) {
                    var invalidChars = cronPart.match(new RegExp("[^".concat(allowedCharsExpression, "]+"), "gi"));
                    if (invalidChars && invalidChars.length) {
                      throw new Error("Expression contains invalid values: '".concat(invalidChars.toString(), "'"));
                    }
                  };
                  return CronParser2;
                })();
                exports2.CronParser = CronParser;
              })
            ),
            /***/
            333: (
              /***/
              ((__unused_webpack_module, exports2, __webpack_require__2) => {
                Object.defineProperty(exports2, "__esModule", { value: true });
                exports2.ExpressionDescriptor = void 0;
                var stringUtilities_1 = __webpack_require__2(823);
                var cronParser_1 = __webpack_require__2(949);
                var ExpressionDescriptor = (function() {
                  function ExpressionDescriptor2(expression, options) {
                    this.expression = expression;
                    this.options = options;
                    this.expressionParts = new Array(5);
                    if (!this.options.locale && ExpressionDescriptor2.defaultLocale) {
                      this.options.locale = ExpressionDescriptor2.defaultLocale;
                    }
                    if (!ExpressionDescriptor2.locales[this.options.locale]) {
                      var fallBackLocale = Object.keys(ExpressionDescriptor2.locales)[0];
                      console.warn("Locale '".concat(this.options.locale, "' could not be found; falling back to '").concat(fallBackLocale, "'."));
                      this.options.locale = fallBackLocale;
                    }
                    this.i18n = ExpressionDescriptor2.locales[this.options.locale];
                    if (options.use24HourTimeFormat === void 0) {
                      options.use24HourTimeFormat = this.i18n.use24HourTimeFormatByDefault();
                    }
                  }
                  ExpressionDescriptor2.toString = function(expression, _a) {
                    var _b = _a === void 0 ? {} : _a, _c = _b.throwExceptionOnParseError, throwExceptionOnParseError = _c === void 0 ? true : _c, _d = _b.verbose, verbose = _d === void 0 ? false : _d, _e = _b.dayOfWeekStartIndexZero, dayOfWeekStartIndexZero = _e === void 0 ? true : _e, _f = _b.monthStartIndexZero, monthStartIndexZero = _f === void 0 ? false : _f, use24HourTimeFormat = _b.use24HourTimeFormat, _g = _b.locale, locale = _g === void 0 ? null : _g, _h = _b.tzOffset, tzOffset = _h === void 0 ? 0 : _h;
                    var options = {
                      throwExceptionOnParseError,
                      verbose,
                      dayOfWeekStartIndexZero,
                      monthStartIndexZero,
                      use24HourTimeFormat,
                      locale,
                      tzOffset
                    };
                    if (options.tzOffset) {
                      console.warn("'tzOffset' option has been deprecated and will be removed in a future release.");
                    }
                    var descripter = new ExpressionDescriptor2(expression, options);
                    return descripter.getFullDescription();
                  };
                  ExpressionDescriptor2.initialize = function(localesLoader, defaultLocale) {
                    if (defaultLocale === void 0) {
                      defaultLocale = "en";
                    }
                    ExpressionDescriptor2.specialCharacters = ["/", "-", ",", "*"];
                    ExpressionDescriptor2.defaultLocale = defaultLocale;
                    localesLoader.load(ExpressionDescriptor2.locales);
                  };
                  ExpressionDescriptor2.prototype.getFullDescription = function() {
                    var description = "";
                    try {
                      var parser = new cronParser_1.CronParser(this.expression, this.options.dayOfWeekStartIndexZero, this.options.monthStartIndexZero);
                      this.expressionParts = parser.parse();
                      var timeSegment = this.getTimeOfDayDescription();
                      var dayOfMonthDesc = this.getDayOfMonthDescription();
                      var monthDesc = this.getMonthDescription();
                      var dayOfWeekDesc = this.getDayOfWeekDescription();
                      var yearDesc = this.getYearDescription();
                      description += timeSegment + dayOfMonthDesc + dayOfWeekDesc + monthDesc + yearDesc;
                      description = this.transformVerbosity(description, !!this.options.verbose);
                      description = description.charAt(0).toLocaleUpperCase() + description.substr(1);
                    } catch (ex) {
                      if (!this.options.throwExceptionOnParseError) {
                        description = this.i18n.anErrorOccuredWhenGeneratingTheExpressionD();
                      } else {
                        throw "".concat(ex);
                      }
                    }
                    return description;
                  };
                  ExpressionDescriptor2.prototype.getTimeOfDayDescription = function() {
                    var secondsExpression = this.expressionParts[0];
                    var minuteExpression = this.expressionParts[1];
                    var hourExpression = this.expressionParts[2];
                    var description = "";
                    if (!stringUtilities_1.StringUtilities.containsAny(minuteExpression, ExpressionDescriptor2.specialCharacters) && !stringUtilities_1.StringUtilities.containsAny(hourExpression, ExpressionDescriptor2.specialCharacters) && !stringUtilities_1.StringUtilities.containsAny(secondsExpression, ExpressionDescriptor2.specialCharacters)) {
                      description += this.i18n.atSpace() + this.formatTime(hourExpression, minuteExpression, secondsExpression);
                    } else if (!secondsExpression && minuteExpression.indexOf("-") > -1 && !(minuteExpression.indexOf(",") > -1) && !(minuteExpression.indexOf("/") > -1) && !stringUtilities_1.StringUtilities.containsAny(hourExpression, ExpressionDescriptor2.specialCharacters)) {
                      var minuteParts = minuteExpression.split("-");
                      description += stringUtilities_1.StringUtilities.format(this.i18n.everyMinuteBetweenX0AndX1(), this.formatTime(hourExpression, minuteParts[0], ""), this.formatTime(hourExpression, minuteParts[1], ""));
                    } else if (!secondsExpression && hourExpression.indexOf(",") > -1 && hourExpression.indexOf("-") == -1 && hourExpression.indexOf("/") == -1 && !stringUtilities_1.StringUtilities.containsAny(minuteExpression, ExpressionDescriptor2.specialCharacters)) {
                      var hourParts = hourExpression.split(",");
                      description += this.i18n.at();
                      for (var i = 0; i < hourParts.length; i++) {
                        description += " ";
                        description += this.formatTime(hourParts[i], minuteExpression, "");
                        if (i < hourParts.length - 2) {
                          description += ",";
                        }
                        if (i == hourParts.length - 2) {
                          description += this.i18n.spaceAnd();
                        }
                      }
                    } else {
                      var secondsDescription = this.getSecondsDescription();
                      var minutesDescription = this.getMinutesDescription();
                      var hoursDescription = this.getHoursDescription();
                      description += secondsDescription;
                      if (description && minutesDescription) {
                        description += ", ";
                      }
                      description += minutesDescription;
                      if (minutesDescription === hoursDescription) {
                        return description;
                      }
                      if (description && hoursDescription) {
                        description += ", ";
                      }
                      description += hoursDescription;
                    }
                    return description;
                  };
                  ExpressionDescriptor2.prototype.getSecondsDescription = function() {
                    var _this = this;
                    var description = this.getSegmentDescription(this.expressionParts[0], this.i18n.everySecond(), function(s) {
                      return s;
                    }, function(s) {
                      return stringUtilities_1.StringUtilities.format(_this.i18n.everyX0Seconds(s), s);
                    }, function(s) {
                      return _this.i18n.secondsX0ThroughX1PastTheMinute();
                    }, function(s) {
                      return s == "0" ? "" : parseInt(s) < 20 ? _this.i18n.atX0SecondsPastTheMinute(s) : _this.i18n.atX0SecondsPastTheMinuteGt20() || _this.i18n.atX0SecondsPastTheMinute(s);
                    });
                    return description;
                  };
                  ExpressionDescriptor2.prototype.getMinutesDescription = function() {
                    var _this = this;
                    var secondsExpression = this.expressionParts[0];
                    var hourExpression = this.expressionParts[2];
                    var description = this.getSegmentDescription(this.expressionParts[1], this.i18n.everyMinute(), function(s) {
                      return s;
                    }, function(s) {
                      return stringUtilities_1.StringUtilities.format(_this.i18n.everyX0Minutes(s), s);
                    }, function(s) {
                      return _this.i18n.minutesX0ThroughX1PastTheHour();
                    }, function(s) {
                      try {
                        return s == "0" && hourExpression.indexOf("/") == -1 && secondsExpression == "" ? _this.i18n.everyHour() : parseInt(s) < 20 ? _this.i18n.atX0MinutesPastTheHour(s) : _this.i18n.atX0MinutesPastTheHourGt20() || _this.i18n.atX0MinutesPastTheHour(s);
                      } catch (e) {
                        return _this.i18n.atX0MinutesPastTheHour(s);
                      }
                    });
                    return description;
                  };
                  ExpressionDescriptor2.prototype.getHoursDescription = function() {
                    var _this = this;
                    var expression = this.expressionParts[2];
                    var hourIndex = 0;
                    var rangeEndValues = [];
                    expression.split("/")[0].split(",").forEach(function(range) {
                      var rangeParts = range.split("-");
                      if (rangeParts.length === 2) {
                        rangeEndValues.push({ value: rangeParts[1], index: hourIndex + 1 });
                      }
                      hourIndex += rangeParts.length;
                    });
                    var evaluationIndex = 0;
                    var description = this.getSegmentDescription(expression, this.i18n.everyHour(), function(s) {
                      var match = rangeEndValues.find(function(r) {
                        return r.value === s && r.index === evaluationIndex;
                      });
                      var isRangeEndWithNonZeroMinute = match && _this.expressionParts[1] !== "0";
                      evaluationIndex++;
                      return isRangeEndWithNonZeroMinute ? _this.formatTime(s, "59", "") : _this.formatTime(s, "0", "");
                    }, function(s) {
                      return stringUtilities_1.StringUtilities.format(_this.i18n.everyX0Hours(s), s);
                    }, function(s) {
                      return _this.i18n.betweenX0AndX1();
                    }, function(s) {
                      return _this.i18n.atX0();
                    });
                    return description;
                  };
                  ExpressionDescriptor2.prototype.getDayOfWeekDescription = function() {
                    var _this = this;
                    var daysOfWeekNames = this.i18n.daysOfTheWeek();
                    var description = null;
                    if (this.expressionParts[5] == "*") {
                      description = "";
                    } else {
                      description = this.getSegmentDescription(this.expressionParts[5], this.i18n.commaEveryDay(), function(s, form) {
                        var exp = s;
                        if (s.indexOf("#") > -1) {
                          exp = s.substring(0, s.indexOf("#"));
                        } else if (s.indexOf("L") > -1) {
                          exp = exp.replace("L", "");
                        }
                        var parsedExp = parseInt(exp);
                        if (_this.options.tzOffset) {
                          var hourExpression = _this.expressionParts[2];
                          var hour = parseInt(hourExpression) + (_this.options.tzOffset ? _this.options.tzOffset : 0);
                          if (hour >= 24) {
                            parsedExp++;
                          } else if (hour < 0) {
                            parsedExp--;
                          }
                          if (parsedExp > 6) {
                            parsedExp = 0;
                          } else if (parsedExp < 0) {
                            parsedExp = 6;
                          }
                        }
                        var description2 = _this.i18n.daysOfTheWeekInCase ? _this.i18n.daysOfTheWeekInCase(form)[parsedExp] : daysOfWeekNames[parsedExp];
                        if (s.indexOf("#") > -1) {
                          var dayOfWeekOfMonthDescription = null;
                          var dayOfWeekOfMonthNumber = s.substring(s.indexOf("#") + 1);
                          var dayOfWeekNumber = s.substring(0, s.indexOf("#"));
                          switch (dayOfWeekOfMonthNumber) {
                            case "1":
                              dayOfWeekOfMonthDescription = _this.i18n.first(dayOfWeekNumber);
                              break;
                            case "2":
                              dayOfWeekOfMonthDescription = _this.i18n.second(dayOfWeekNumber);
                              break;
                            case "3":
                              dayOfWeekOfMonthDescription = _this.i18n.third(dayOfWeekNumber);
                              break;
                            case "4":
                              dayOfWeekOfMonthDescription = _this.i18n.fourth(dayOfWeekNumber);
                              break;
                            case "5":
                              dayOfWeekOfMonthDescription = _this.i18n.fifth(dayOfWeekNumber);
                              break;
                          }
                          description2 = dayOfWeekOfMonthDescription + " " + description2;
                        }
                        return description2;
                      }, function(s) {
                        if (parseInt(s) == 1) {
                          return "";
                        } else {
                          return stringUtilities_1.StringUtilities.format(_this.i18n.commaEveryX0DaysOfTheWeek(s), s);
                        }
                      }, function(s) {
                        var beginFrom = s.substring(0, s.indexOf("-"));
                        var domSpecified = _this.expressionParts[3] != "*";
                        return domSpecified ? _this.i18n.commaAndX0ThroughX1(beginFrom) : _this.i18n.commaX0ThroughX1(beginFrom);
                      }, function(s) {
                        var format2 = null;
                        if (s.indexOf("#") > -1) {
                          var dayOfWeekOfMonthNumber = s.substring(s.indexOf("#") + 1);
                          var dayOfWeek = s.substring(0, s.indexOf("#"));
                          format2 = _this.i18n.commaOnThe(dayOfWeekOfMonthNumber, dayOfWeek).trim() + _this.i18n.spaceX0OfTheMonth();
                        } else if (s.indexOf("L") > -1) {
                          format2 = _this.i18n.commaOnTheLastX0OfTheMonth(s.replace("L", ""));
                        } else {
                          var domSpecified = _this.expressionParts[3] != "*";
                          format2 = domSpecified ? _this.i18n.commaAndOnX0() : _this.i18n.commaOnlyOnX0(s);
                        }
                        return format2;
                      });
                    }
                    return description;
                  };
                  ExpressionDescriptor2.prototype.getMonthDescription = function() {
                    var _this = this;
                    var monthNames = this.i18n.monthsOfTheYear();
                    var description = this.getSegmentDescription(this.expressionParts[4], "", function(s, form) {
                      return form && _this.i18n.monthsOfTheYearInCase ? _this.i18n.monthsOfTheYearInCase(form)[parseInt(s) - 1] : monthNames[parseInt(s) - 1];
                    }, function(s) {
                      if (parseInt(s) == 1) {
                        return "";
                      } else {
                        return stringUtilities_1.StringUtilities.format(_this.i18n.commaEveryX0Months(s), s);
                      }
                    }, function(s) {
                      return _this.i18n.commaMonthX0ThroughMonthX1() || _this.i18n.commaX0ThroughX1();
                    }, function(s) {
                      return _this.i18n.commaOnlyInMonthX0 ? _this.i18n.commaOnlyInMonthX0() : _this.i18n.commaOnlyInX0();
                    });
                    return description;
                  };
                  ExpressionDescriptor2.prototype.getDayOfMonthDescription = function() {
                    var _this = this;
                    var description = null;
                    var expression = this.expressionParts[3];
                    switch (expression) {
                      case "L":
                        description = this.i18n.commaOnTheLastDayOfTheMonth();
                        break;
                      case "WL":
                      case "LW":
                        description = this.i18n.commaOnTheLastWeekdayOfTheMonth();
                        break;
                      default:
                        var weekDayNumberMatches = expression.match(/(\d{1,2}W)|(W\d{1,2})/);
                        if (weekDayNumberMatches) {
                          var dayNumber = parseInt(weekDayNumberMatches[0].replace("W", ""));
                          var dayString = dayNumber == 1 ? this.i18n.firstWeekday() : stringUtilities_1.StringUtilities.format(this.i18n.weekdayNearestDayX0(), dayNumber.toString());
                          description = stringUtilities_1.StringUtilities.format(this.i18n.commaOnTheX0OfTheMonth(), dayString);
                          break;
                        } else {
                          var lastDayOffSetMatches = expression.match(/L-(\d{1,2})/);
                          if (lastDayOffSetMatches) {
                            var offSetDays = lastDayOffSetMatches[1];
                            description = stringUtilities_1.StringUtilities.format(this.i18n.commaDaysBeforeTheLastDayOfTheMonth(offSetDays), offSetDays);
                            break;
                          } else if (expression == "*" && this.expressionParts[5] != "*") {
                            return "";
                          } else {
                            description = this.getSegmentDescription(expression, this.i18n.commaEveryDay(), function(s) {
                              return s == "L" ? _this.i18n.lastDay() : _this.i18n.dayX0 ? stringUtilities_1.StringUtilities.format(_this.i18n.dayX0(), s) : s;
                            }, function(s) {
                              return s == "1" ? _this.i18n.commaEveryDay() : _this.i18n.commaEveryX0Days(s);
                            }, function(s) {
                              return _this.i18n.commaBetweenDayX0AndX1OfTheMonth(s);
                            }, function(s) {
                              return _this.i18n.commaOnDayX0OfTheMonth(s);
                            });
                          }
                          break;
                        }
                    }
                    return description;
                  };
                  ExpressionDescriptor2.prototype.getYearDescription = function() {
                    var _this = this;
                    var description = this.getSegmentDescription(this.expressionParts[6], "", function(s) {
                      return /^\d+$/.test(s) ? new Date(parseInt(s), 1).getFullYear().toString() : s;
                    }, function(s) {
                      return stringUtilities_1.StringUtilities.format(_this.i18n.commaEveryX0Years(s), s);
                    }, function(s) {
                      return _this.i18n.commaYearX0ThroughYearX1() || _this.i18n.commaX0ThroughX1();
                    }, function(s) {
                      return _this.i18n.commaOnlyInYearX0 ? _this.i18n.commaOnlyInYearX0() : _this.i18n.commaOnlyInX0();
                    });
                    return description;
                  };
                  ExpressionDescriptor2.prototype.getSegmentDescription = function(expression, allDescription, getSingleItemDescription, getIncrementDescriptionFormat, getRangeDescriptionFormat, getDescriptionFormat) {
                    var description = null;
                    var doesExpressionContainIncrement = expression.indexOf("/") > -1;
                    var doesExpressionContainRange = expression.indexOf("-") > -1;
                    var doesExpressionContainMultipleValues = expression.indexOf(",") > -1;
                    if (!expression) {
                      description = "";
                    } else if (expression === "*") {
                      description = allDescription;
                    } else if (!doesExpressionContainIncrement && !doesExpressionContainRange && !doesExpressionContainMultipleValues) {
                      description = stringUtilities_1.StringUtilities.format(getDescriptionFormat(expression), getSingleItemDescription(expression));
                    } else if (doesExpressionContainMultipleValues) {
                      var segments = expression.split(",");
                      var descriptionContent = "";
                      for (var i = 0; i < segments.length; i++) {
                        if (i > 0 && segments.length > 2) {
                          descriptionContent += ",";
                          if (i < segments.length - 1) {
                            descriptionContent += " ";
                          }
                        }
                        if (i > 0 && segments.length > 1 && (i == segments.length - 1 || segments.length == 2)) {
                          descriptionContent += "".concat(this.i18n.spaceAnd(), " ");
                        }
                        if (segments[i].indexOf("/") > -1 || segments[i].indexOf("-") > -1) {
                          var isSegmentRangeWithoutIncrement = segments[i].indexOf("-") > -1 && segments[i].indexOf("/") == -1;
                          var currentDescriptionContent = this.getSegmentDescription(segments[i], allDescription, getSingleItemDescription, getIncrementDescriptionFormat, isSegmentRangeWithoutIncrement ? this.i18n.commaX0ThroughX1 : getRangeDescriptionFormat, getDescriptionFormat);
                          if (isSegmentRangeWithoutIncrement) {
                            currentDescriptionContent = currentDescriptionContent.replace(", ", "");
                          }
                          descriptionContent += currentDescriptionContent;
                        } else if (!doesExpressionContainIncrement) {
                          descriptionContent += getSingleItemDescription(segments[i]);
                        } else {
                          descriptionContent += this.getSegmentDescription(segments[i], allDescription, getSingleItemDescription, getIncrementDescriptionFormat, getRangeDescriptionFormat, getDescriptionFormat);
                        }
                      }
                      if (!doesExpressionContainIncrement) {
                        description = stringUtilities_1.StringUtilities.format(getDescriptionFormat(expression), descriptionContent);
                      } else {
                        description = descriptionContent;
                      }
                    } else if (doesExpressionContainIncrement) {
                      var segments = expression.split("/");
                      description = stringUtilities_1.StringUtilities.format(getIncrementDescriptionFormat(segments[1]), segments[1]);
                      if (segments[0].indexOf("-") > -1) {
                        var rangeSegmentDescription = this.generateRangeSegmentDescription(segments[0], getRangeDescriptionFormat, getSingleItemDescription);
                        if (rangeSegmentDescription.indexOf(", ") != 0) {
                          description += ", ";
                        }
                        description += rangeSegmentDescription;
                      } else if (segments[0].indexOf("*") == -1) {
                        var rangeItemDescription = stringUtilities_1.StringUtilities.format(getDescriptionFormat(segments[0]), getSingleItemDescription(segments[0]));
                        rangeItemDescription = rangeItemDescription.replace(", ", "");
                        description += stringUtilities_1.StringUtilities.format(this.i18n.commaStartingX0(), rangeItemDescription);
                      }
                    } else if (doesExpressionContainRange) {
                      description = this.generateRangeSegmentDescription(expression, getRangeDescriptionFormat, getSingleItemDescription);
                    }
                    return description;
                  };
                  ExpressionDescriptor2.prototype.generateRangeSegmentDescription = function(rangeExpression, getRangeDescriptionFormat, getSingleItemDescription) {
                    var description = "";
                    var rangeSegments = rangeExpression.split("-");
                    var rangeSegment1Description = getSingleItemDescription(rangeSegments[0], 1);
                    var rangeSegment2Description = getSingleItemDescription(rangeSegments[1], 2);
                    var rangeDescriptionFormat = getRangeDescriptionFormat(rangeExpression);
                    description += stringUtilities_1.StringUtilities.format(rangeDescriptionFormat, rangeSegment1Description, rangeSegment2Description);
                    return description;
                  };
                  ExpressionDescriptor2.prototype.formatTime = function(hourExpression, minuteExpression, secondExpression) {
                    var hourOffset = 0;
                    var minuteOffset = 0;
                    if (this.options.tzOffset) {
                      hourOffset = this.options.tzOffset > 0 ? Math.floor(this.options.tzOffset) : Math.ceil(this.options.tzOffset);
                      minuteOffset = parseFloat((this.options.tzOffset % 1).toFixed(2));
                      if (minuteOffset != 0) {
                        minuteOffset *= 60;
                      }
                    }
                    var hour = parseInt(hourExpression) + hourOffset;
                    var minute = parseInt(minuteExpression) + minuteOffset;
                    if (minute >= 60) {
                      minute -= 60;
                      hour += 1;
                    } else if (minute < 0) {
                      minute += 60;
                      hour -= 1;
                    }
                    if (hour >= 24) {
                      hour = hour - 24;
                    } else if (hour < 0) {
                      hour = 24 + hour;
                    }
                    var period = "";
                    var setPeriodBeforeTime = false;
                    if (!this.options.use24HourTimeFormat) {
                      setPeriodBeforeTime = !!(this.i18n.setPeriodBeforeTime && this.i18n.setPeriodBeforeTime());
                      period = setPeriodBeforeTime ? "".concat(this.getPeriod(hour), " ") : " ".concat(this.getPeriod(hour));
                      if (hour > 12) {
                        hour -= 12;
                      }
                      if (hour === 0) {
                        hour = 12;
                      }
                    }
                    var second = "";
                    if (secondExpression) {
                      second = ":".concat(("00" + secondExpression).substring(secondExpression.length));
                    }
                    return "".concat(setPeriodBeforeTime ? period : "").concat(("00" + hour.toString()).substring(hour.toString().length), ":").concat(("00" + minute.toString()).substring(minute.toString().length)).concat(second).concat(!setPeriodBeforeTime ? period : "");
                  };
                  ExpressionDescriptor2.prototype.transformVerbosity = function(description, useVerboseFormat) {
                    if (!useVerboseFormat) {
                      description = description.replace(new RegExp(", ".concat(this.i18n.everyMinute()), "g"), "");
                      description = description.replace(new RegExp(", ".concat(this.i18n.everyHour()), "g"), "");
                      description = description.replace(new RegExp(this.i18n.commaEveryDay(), "g"), "");
                      description = description.replace(/\, ?$/, "");
                      if (this.i18n.conciseVerbosityReplacements) {
                        for (var _i = 0, _a = Object.entries(this.i18n.conciseVerbosityReplacements()); _i < _a.length; _i++) {
                          var _b = _a[_i], key = _b[0], value = _b[1];
                          description = description.replace(new RegExp(key, "g"), value);
                        }
                      }
                    }
                    return description;
                  };
                  ExpressionDescriptor2.prototype.getPeriod = function(hour) {
                    return hour >= 12 ? this.i18n.pm && this.i18n.pm() || "PM" : this.i18n.am && this.i18n.am() || "AM";
                  };
                  ExpressionDescriptor2.locales = {};
                  return ExpressionDescriptor2;
                })();
                exports2.ExpressionDescriptor = ExpressionDescriptor;
              })
            ),
            /***/
            747: (
              /***/
              ((__unused_webpack_module, exports2, __webpack_require__2) => {
                Object.defineProperty(exports2, "__esModule", { value: true });
                exports2.enLocaleLoader = void 0;
                var en_1 = __webpack_require__2(486);
                var enLocaleLoader = (function() {
                  function enLocaleLoader2() {
                  }
                  enLocaleLoader2.prototype.load = function(availableLocales) {
                    availableLocales["en"] = new en_1.en();
                  };
                  return enLocaleLoader2;
                })();
                exports2.enLocaleLoader = enLocaleLoader;
              })
            ),
            /***/
            486: (
              /***/
              ((__unused_webpack_module, exports2) => {
                Object.defineProperty(exports2, "__esModule", { value: true });
                exports2.en = void 0;
                var en = (function() {
                  function en2() {
                  }
                  en2.prototype.atX0SecondsPastTheMinuteGt20 = function() {
                    return null;
                  };
                  en2.prototype.atX0MinutesPastTheHourGt20 = function() {
                    return null;
                  };
                  en2.prototype.commaMonthX0ThroughMonthX1 = function() {
                    return null;
                  };
                  en2.prototype.commaYearX0ThroughYearX1 = function() {
                    return null;
                  };
                  en2.prototype.use24HourTimeFormatByDefault = function() {
                    return false;
                  };
                  en2.prototype.anErrorOccuredWhenGeneratingTheExpressionD = function() {
                    return "An error occurred when generating the expression description. Check the cron expression syntax.";
                  };
                  en2.prototype.everyMinute = function() {
                    return "every minute";
                  };
                  en2.prototype.everyHour = function() {
                    return "every hour";
                  };
                  en2.prototype.atSpace = function() {
                    return "At ";
                  };
                  en2.prototype.everyMinuteBetweenX0AndX1 = function() {
                    return "Every minute between %s and %s";
                  };
                  en2.prototype.at = function() {
                    return "At";
                  };
                  en2.prototype.spaceAnd = function() {
                    return " and";
                  };
                  en2.prototype.everySecond = function() {
                    return "every second";
                  };
                  en2.prototype.everyX0Seconds = function() {
                    return "every %s seconds";
                  };
                  en2.prototype.secondsX0ThroughX1PastTheMinute = function() {
                    return "seconds %s through %s past the minute";
                  };
                  en2.prototype.atX0SecondsPastTheMinute = function() {
                    return "at %s seconds past the minute";
                  };
                  en2.prototype.everyX0Minutes = function() {
                    return "every %s minutes";
                  };
                  en2.prototype.minutesX0ThroughX1PastTheHour = function() {
                    return "minutes %s through %s past the hour";
                  };
                  en2.prototype.atX0MinutesPastTheHour = function() {
                    return "at %s minutes past the hour";
                  };
                  en2.prototype.everyX0Hours = function() {
                    return "every %s hours";
                  };
                  en2.prototype.betweenX0AndX1 = function() {
                    return "between %s and %s";
                  };
                  en2.prototype.atX0 = function() {
                    return "at %s";
                  };
                  en2.prototype.commaEveryDay = function() {
                    return ", every day";
                  };
                  en2.prototype.commaEveryX0DaysOfTheWeek = function() {
                    return ", every %s days of the week";
                  };
                  en2.prototype.commaX0ThroughX1 = function() {
                    return ", %s through %s";
                  };
                  en2.prototype.commaAndX0ThroughX1 = function() {
                    return ", %s through %s";
                  };
                  en2.prototype.first = function() {
                    return "first";
                  };
                  en2.prototype.second = function() {
                    return "second";
                  };
                  en2.prototype.third = function() {
                    return "third";
                  };
                  en2.prototype.fourth = function() {
                    return "fourth";
                  };
                  en2.prototype.fifth = function() {
                    return "fifth";
                  };
                  en2.prototype.commaOnThe = function() {
                    return ", on the ";
                  };
                  en2.prototype.spaceX0OfTheMonth = function() {
                    return " %s of the month";
                  };
                  en2.prototype.lastDay = function() {
                    return "the last day";
                  };
                  en2.prototype.commaOnTheLastX0OfTheMonth = function() {
                    return ", on the last %s of the month";
                  };
                  en2.prototype.commaOnlyOnX0 = function() {
                    return ", only on %s";
                  };
                  en2.prototype.commaAndOnX0 = function() {
                    return ", and on %s";
                  };
                  en2.prototype.commaEveryX0Months = function() {
                    return ", every %s months";
                  };
                  en2.prototype.commaOnlyInX0 = function() {
                    return ", only in %s";
                  };
                  en2.prototype.commaOnTheLastDayOfTheMonth = function() {
                    return ", on the last day of the month";
                  };
                  en2.prototype.commaOnTheLastWeekdayOfTheMonth = function() {
                    return ", on the last weekday of the month";
                  };
                  en2.prototype.commaDaysBeforeTheLastDayOfTheMonth = function() {
                    return ", %s days before the last day of the month";
                  };
                  en2.prototype.firstWeekday = function() {
                    return "first weekday";
                  };
                  en2.prototype.weekdayNearestDayX0 = function() {
                    return "weekday nearest day %s";
                  };
                  en2.prototype.commaOnTheX0OfTheMonth = function() {
                    return ", on the %s of the month";
                  };
                  en2.prototype.commaEveryX0Days = function() {
                    return ", every %s days";
                  };
                  en2.prototype.commaBetweenDayX0AndX1OfTheMonth = function() {
                    return ", between day %s and %s of the month";
                  };
                  en2.prototype.commaOnDayX0OfTheMonth = function() {
                    return ", on day %s of the month";
                  };
                  en2.prototype.commaEveryHour = function() {
                    return ", every hour";
                  };
                  en2.prototype.commaEveryX0Years = function() {
                    return ", every %s years";
                  };
                  en2.prototype.commaStartingX0 = function() {
                    return ", starting %s";
                  };
                  en2.prototype.daysOfTheWeek = function() {
                    return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                  };
                  en2.prototype.monthsOfTheYear = function() {
                    return [
                      "January",
                      "February",
                      "March",
                      "April",
                      "May",
                      "June",
                      "July",
                      "August",
                      "September",
                      "October",
                      "November",
                      "December"
                    ];
                  };
                  return en2;
                })();
                exports2.en = en;
              })
            ),
            /***/
            515: (
              /***/
              ((__unused_webpack_module, exports2) => {
                Object.defineProperty(exports2, "__esModule", { value: true });
                function assert(value, message) {
                  if (!value) {
                    throw new Error(message);
                  }
                }
                var RangeValidator = (function() {
                  function RangeValidator2() {
                  }
                  RangeValidator2.secondRange = function(parse) {
                    var parsed = parse.split(",");
                    for (var i = 0; i < parsed.length; i++) {
                      if (!isNaN(parseInt(parsed[i], 10))) {
                        var second = parseInt(parsed[i], 10);
                        assert(second >= 0 && second <= 59, "seconds part must be >= 0 and <= 59");
                      }
                    }
                  };
                  RangeValidator2.minuteRange = function(parse) {
                    var parsed = parse.split(",");
                    for (var i = 0; i < parsed.length; i++) {
                      if (!isNaN(parseInt(parsed[i], 10))) {
                        var minute = parseInt(parsed[i], 10);
                        assert(minute >= 0 && minute <= 59, "minutes part must be >= 0 and <= 59");
                      }
                    }
                  };
                  RangeValidator2.hourRange = function(parse) {
                    var parsed = parse.split(",");
                    for (var i = 0; i < parsed.length; i++) {
                      if (!isNaN(parseInt(parsed[i], 10))) {
                        var hour = parseInt(parsed[i], 10);
                        assert(hour >= 0 && hour <= 23, "hours part must be >= 0 and <= 23");
                      }
                    }
                  };
                  RangeValidator2.dayOfMonthRange = function(parse) {
                    var parsed = parse.split(",");
                    for (var i = 0; i < parsed.length; i++) {
                      if (!isNaN(parseInt(parsed[i], 10))) {
                        var dayOfMonth = parseInt(parsed[i], 10);
                        assert(dayOfMonth >= 1 && dayOfMonth <= 31, "DOM part must be >= 1 and <= 31");
                      }
                    }
                  };
                  RangeValidator2.monthRange = function(parse, monthStartIndexZero) {
                    var parsed = parse.split(",");
                    for (var i = 0; i < parsed.length; i++) {
                      if (!isNaN(parseInt(parsed[i], 10))) {
                        var month = parseInt(parsed[i], 10);
                        assert(month >= 1 && month <= 12, monthStartIndexZero ? "month part must be >= 0 and <= 11" : "month part must be >= 1 and <= 12");
                      }
                    }
                  };
                  RangeValidator2.dayOfWeekRange = function(parse, dayOfWeekStartIndexZero) {
                    var parsed = parse.split(",");
                    for (var i = 0; i < parsed.length; i++) {
                      if (!isNaN(parseInt(parsed[i], 10))) {
                        var dayOfWeek = parseInt(parsed[i], 10);
                        assert(dayOfWeek >= 0 && dayOfWeek <= 6, dayOfWeekStartIndexZero ? "DOW part must be >= 0 and <= 6" : "DOW part must be >= 1 and <= 7");
                      }
                    }
                  };
                  return RangeValidator2;
                })();
                exports2["default"] = RangeValidator;
              })
            ),
            /***/
            823: (
              /***/
              ((__unused_webpack_module, exports2) => {
                Object.defineProperty(exports2, "__esModule", { value: true });
                exports2.StringUtilities = void 0;
                var StringUtilities = (function() {
                  function StringUtilities2() {
                  }
                  StringUtilities2.format = function(template) {
                    var values = [];
                    for (var _i = 1; _i < arguments.length; _i++) {
                      values[_i - 1] = arguments[_i];
                    }
                    return template.replace(/%s/g, function(substring) {
                      var args = [];
                      for (var _i2 = 1; _i2 < arguments.length; _i2++) {
                        args[_i2 - 1] = arguments[_i2];
                      }
                      return values.shift();
                    });
                  };
                  StringUtilities2.containsAny = function(text, searchStrings) {
                    return searchStrings.some(function(c) {
                      return text.indexOf(c) > -1;
                    });
                  };
                  return StringUtilities2;
                })();
                exports2.StringUtilities = StringUtilities;
              })
            )
            /******/
          };
          var __webpack_module_cache__ = {};
          function __webpack_require__(moduleId) {
            var cachedModule = __webpack_module_cache__[moduleId];
            if (cachedModule !== void 0) {
              return cachedModule.exports;
            }
            var module2 = __webpack_module_cache__[moduleId] = {
              /******/
              // no module.id needed
              /******/
              // no module.loaded needed
              /******/
              exports: {}
              /******/
            };
            __webpack_modules__[moduleId](module2, module2.exports, __webpack_require__);
            return module2.exports;
          }
          var __webpack_exports__ = {};
          (() => {
            var exports2 = __webpack_exports__;
            Object.defineProperty(exports2, "__esModule", { value: true });
            exports2.toString = void 0;
            var expressionDescriptor_1 = __webpack_require__(333);
            var enLocaleLoader_1 = __webpack_require__(747);
            expressionDescriptor_1.ExpressionDescriptor.initialize(new enLocaleLoader_1.enLocaleLoader());
            exports2["default"] = expressionDescriptor_1.ExpressionDescriptor;
            var toString = expressionDescriptor_1.ExpressionDescriptor.toString;
            exports2.toString = toString;
          })();
          return __webpack_exports__;
        })()
      );
    });
  }
});

// node_modules/ajv/dist/compile/codegen/code.js
var require_code = __commonJS({
  "node_modules/ajv/dist/compile/codegen/code.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.regexpCode = exports.getEsmExportName = exports.getProperty = exports.safeStringify = exports.stringify = exports.strConcat = exports.addCodeArg = exports.str = exports._ = exports.nil = exports._Code = exports.Name = exports.IDENTIFIER = exports._CodeOrName = void 0;
    var _CodeOrName = class {
    };
    exports._CodeOrName = _CodeOrName;
    exports.IDENTIFIER = /^[a-z$_][a-z$_0-9]*$/i;
    var Name = class extends _CodeOrName {
      constructor(s) {
        super();
        if (!exports.IDENTIFIER.test(s))
          throw new Error("CodeGen: name must be a valid identifier");
        this.str = s;
      }
      toString() {
        return this.str;
      }
      emptyStr() {
        return false;
      }
      get names() {
        return { [this.str]: 1 };
      }
    };
    exports.Name = Name;
    var _Code = class extends _CodeOrName {
      constructor(code) {
        super();
        this._items = typeof code === "string" ? [code] : code;
      }
      toString() {
        return this.str;
      }
      emptyStr() {
        if (this._items.length > 1)
          return false;
        const item = this._items[0];
        return item === "" || item === '""';
      }
      get str() {
        var _a;
        return (_a = this._str) !== null && _a !== void 0 ? _a : this._str = this._items.reduce((s, c) => `${s}${c}`, "");
      }
      get names() {
        var _a;
        return (_a = this._names) !== null && _a !== void 0 ? _a : this._names = this._items.reduce((names, c) => {
          if (c instanceof Name)
            names[c.str] = (names[c.str] || 0) + 1;
          return names;
        }, {});
      }
    };
    exports._Code = _Code;
    exports.nil = new _Code("");
    function _(strs, ...args) {
      const code = [strs[0]];
      let i = 0;
      while (i < args.length) {
        addCodeArg(code, args[i]);
        code.push(strs[++i]);
      }
      return new _Code(code);
    }
    exports._ = _;
    var plus = new _Code("+");
    function str(strs, ...args) {
      const expr = [safeStringify(strs[0])];
      let i = 0;
      while (i < args.length) {
        expr.push(plus);
        addCodeArg(expr, args[i]);
        expr.push(plus, safeStringify(strs[++i]));
      }
      optimize(expr);
      return new _Code(expr);
    }
    exports.str = str;
    function addCodeArg(code, arg) {
      if (arg instanceof _Code)
        code.push(...arg._items);
      else if (arg instanceof Name)
        code.push(arg);
      else
        code.push(interpolate(arg));
    }
    exports.addCodeArg = addCodeArg;
    function optimize(expr) {
      let i = 1;
      while (i < expr.length - 1) {
        if (expr[i] === plus) {
          const res = mergeExprItems(expr[i - 1], expr[i + 1]);
          if (res !== void 0) {
            expr.splice(i - 1, 3, res);
            continue;
          }
          expr[i++] = "+";
        }
        i++;
      }
    }
    function mergeExprItems(a, b) {
      if (b === '""')
        return a;
      if (a === '""')
        return b;
      if (typeof a == "string") {
        if (b instanceof Name || a[a.length - 1] !== '"')
          return;
        if (typeof b != "string")
          return `${a.slice(0, -1)}${b}"`;
        if (b[0] === '"')
          return a.slice(0, -1) + b.slice(1);
        return;
      }
      if (typeof b == "string" && b[0] === '"' && !(a instanceof Name))
        return `"${a}${b.slice(1)}`;
      return;
    }
    function strConcat(c1, c2) {
      return c2.emptyStr() ? c1 : c1.emptyStr() ? c2 : str`${c1}${c2}`;
    }
    exports.strConcat = strConcat;
    function interpolate(x) {
      return typeof x == "number" || typeof x == "boolean" || x === null ? x : safeStringify(Array.isArray(x) ? x.join(",") : x);
    }
    function stringify(x) {
      return new _Code(safeStringify(x));
    }
    exports.stringify = stringify;
    function safeStringify(x) {
      return JSON.stringify(x).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
    }
    exports.safeStringify = safeStringify;
    function getProperty(key) {
      return typeof key == "string" && exports.IDENTIFIER.test(key) ? new _Code(`.${key}`) : _`[${key}]`;
    }
    exports.getProperty = getProperty;
    function getEsmExportName(key) {
      if (typeof key == "string" && exports.IDENTIFIER.test(key)) {
        return new _Code(`${key}`);
      }
      throw new Error(`CodeGen: invalid export name: ${key}, use explicit $id name mapping`);
    }
    exports.getEsmExportName = getEsmExportName;
    function regexpCode(rx) {
      return new _Code(rx.toString());
    }
    exports.regexpCode = regexpCode;
  }
});

// node_modules/ajv/dist/compile/codegen/scope.js
var require_scope = __commonJS({
  "node_modules/ajv/dist/compile/codegen/scope.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ValueScope = exports.ValueScopeName = exports.Scope = exports.varKinds = exports.UsedValueState = void 0;
    var code_1 = require_code();
    var ValueError = class extends Error {
      constructor(name2) {
        super(`CodeGen: "code" for ${name2} not defined`);
        this.value = name2.value;
      }
    };
    var UsedValueState;
    (function(UsedValueState2) {
      UsedValueState2[UsedValueState2["Started"] = 0] = "Started";
      UsedValueState2[UsedValueState2["Completed"] = 1] = "Completed";
    })(UsedValueState || (exports.UsedValueState = UsedValueState = {}));
    exports.varKinds = {
      const: new code_1.Name("const"),
      let: new code_1.Name("let"),
      var: new code_1.Name("var")
    };
    var Scope = class {
      constructor({ prefixes, parent } = {}) {
        this._names = {};
        this._prefixes = prefixes;
        this._parent = parent;
      }
      toName(nameOrPrefix) {
        return nameOrPrefix instanceof code_1.Name ? nameOrPrefix : this.name(nameOrPrefix);
      }
      name(prefix) {
        return new code_1.Name(this._newName(prefix));
      }
      _newName(prefix) {
        const ng = this._names[prefix] || this._nameGroup(prefix);
        return `${prefix}${ng.index++}`;
      }
      _nameGroup(prefix) {
        var _a, _b;
        if (((_b = (_a = this._parent) === null || _a === void 0 ? void 0 : _a._prefixes) === null || _b === void 0 ? void 0 : _b.has(prefix)) || this._prefixes && !this._prefixes.has(prefix)) {
          throw new Error(`CodeGen: prefix "${prefix}" is not allowed in this scope`);
        }
        return this._names[prefix] = { prefix, index: 0 };
      }
    };
    exports.Scope = Scope;
    var ValueScopeName = class extends code_1.Name {
      constructor(prefix, nameStr) {
        super(nameStr);
        this.prefix = prefix;
      }
      setValue(value, { property, itemIndex }) {
        this.value = value;
        this.scopePath = (0, code_1._)`.${new code_1.Name(property)}[${itemIndex}]`;
      }
    };
    exports.ValueScopeName = ValueScopeName;
    var line = (0, code_1._)`\n`;
    var ValueScope = class extends Scope {
      constructor(opts) {
        super(opts);
        this._values = {};
        this._scope = opts.scope;
        this.opts = { ...opts, _n: opts.lines ? line : code_1.nil };
      }
      get() {
        return this._scope;
      }
      name(prefix) {
        return new ValueScopeName(prefix, this._newName(prefix));
      }
      value(nameOrPrefix, value) {
        var _a;
        if (value.ref === void 0)
          throw new Error("CodeGen: ref must be passed in value");
        const name2 = this.toName(nameOrPrefix);
        const { prefix } = name2;
        const valueKey = (_a = value.key) !== null && _a !== void 0 ? _a : value.ref;
        let vs = this._values[prefix];
        if (vs) {
          const _name = vs.get(valueKey);
          if (_name)
            return _name;
        } else {
          vs = this._values[prefix] = /* @__PURE__ */ new Map();
        }
        vs.set(valueKey, name2);
        const s = this._scope[prefix] || (this._scope[prefix] = []);
        const itemIndex = s.length;
        s[itemIndex] = value.ref;
        name2.setValue(value, { property: prefix, itemIndex });
        return name2;
      }
      getValue(prefix, keyOrRef) {
        const vs = this._values[prefix];
        if (!vs)
          return;
        return vs.get(keyOrRef);
      }
      scopeRefs(scopeName, values = this._values) {
        return this._reduceValues(values, (name2) => {
          if (name2.scopePath === void 0)
            throw new Error(`CodeGen: name "${name2}" has no value`);
          return (0, code_1._)`${scopeName}${name2.scopePath}`;
        });
      }
      scopeCode(values = this._values, usedValues, getCode) {
        return this._reduceValues(values, (name2) => {
          if (name2.value === void 0)
            throw new Error(`CodeGen: name "${name2}" has no value`);
          return name2.value.code;
        }, usedValues, getCode);
      }
      _reduceValues(values, valueCode, usedValues = {}, getCode) {
        let code = code_1.nil;
        for (const prefix in values) {
          const vs = values[prefix];
          if (!vs)
            continue;
          const nameSet = usedValues[prefix] = usedValues[prefix] || /* @__PURE__ */ new Map();
          vs.forEach((name2) => {
            if (nameSet.has(name2))
              return;
            nameSet.set(name2, UsedValueState.Started);
            let c = valueCode(name2);
            if (c) {
              const def = this.opts.es5 ? exports.varKinds.var : exports.varKinds.const;
              code = (0, code_1._)`${code}${def} ${name2} = ${c};${this.opts._n}`;
            } else if (c = getCode === null || getCode === void 0 ? void 0 : getCode(name2)) {
              code = (0, code_1._)`${code}${c}${this.opts._n}`;
            } else {
              throw new ValueError(name2);
            }
            nameSet.set(name2, UsedValueState.Completed);
          });
        }
        return code;
      }
    };
    exports.ValueScope = ValueScope;
  }
});

// node_modules/ajv/dist/compile/codegen/index.js
var require_codegen = __commonJS({
  "node_modules/ajv/dist/compile/codegen/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.or = exports.and = exports.not = exports.CodeGen = exports.operators = exports.varKinds = exports.ValueScopeName = exports.ValueScope = exports.Scope = exports.Name = exports.regexpCode = exports.stringify = exports.getProperty = exports.nil = exports.strConcat = exports.str = exports._ = void 0;
    var code_1 = require_code();
    var scope_1 = require_scope();
    var code_2 = require_code();
    Object.defineProperty(exports, "_", { enumerable: true, get: function() {
      return code_2._;
    } });
    Object.defineProperty(exports, "str", { enumerable: true, get: function() {
      return code_2.str;
    } });
    Object.defineProperty(exports, "strConcat", { enumerable: true, get: function() {
      return code_2.strConcat;
    } });
    Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
      return code_2.nil;
    } });
    Object.defineProperty(exports, "getProperty", { enumerable: true, get: function() {
      return code_2.getProperty;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
      return code_2.stringify;
    } });
    Object.defineProperty(exports, "regexpCode", { enumerable: true, get: function() {
      return code_2.regexpCode;
    } });
    Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
      return code_2.Name;
    } });
    var scope_2 = require_scope();
    Object.defineProperty(exports, "Scope", { enumerable: true, get: function() {
      return scope_2.Scope;
    } });
    Object.defineProperty(exports, "ValueScope", { enumerable: true, get: function() {
      return scope_2.ValueScope;
    } });
    Object.defineProperty(exports, "ValueScopeName", { enumerable: true, get: function() {
      return scope_2.ValueScopeName;
    } });
    Object.defineProperty(exports, "varKinds", { enumerable: true, get: function() {
      return scope_2.varKinds;
    } });
    exports.operators = {
      GT: new code_1._Code(">"),
      GTE: new code_1._Code(">="),
      LT: new code_1._Code("<"),
      LTE: new code_1._Code("<="),
      EQ: new code_1._Code("==="),
      NEQ: new code_1._Code("!=="),
      NOT: new code_1._Code("!"),
      OR: new code_1._Code("||"),
      AND: new code_1._Code("&&"),
      ADD: new code_1._Code("+")
    };
    var Node = class {
      optimizeNodes() {
        return this;
      }
      optimizeNames(_names, _constants) {
        return this;
      }
    };
    var Def = class extends Node {
      constructor(varKind, name2, rhs) {
        super();
        this.varKind = varKind;
        this.name = name2;
        this.rhs = rhs;
      }
      render({ es5, _n }) {
        const varKind = es5 ? scope_1.varKinds.var : this.varKind;
        const rhs = this.rhs === void 0 ? "" : ` = ${this.rhs}`;
        return `${varKind} ${this.name}${rhs};` + _n;
      }
      optimizeNames(names, constants) {
        if (!names[this.name.str])
          return;
        if (this.rhs)
          this.rhs = optimizeExpr(this.rhs, names, constants);
        return this;
      }
      get names() {
        return this.rhs instanceof code_1._CodeOrName ? this.rhs.names : {};
      }
    };
    var Assign = class extends Node {
      constructor(lhs, rhs, sideEffects) {
        super();
        this.lhs = lhs;
        this.rhs = rhs;
        this.sideEffects = sideEffects;
      }
      render({ _n }) {
        return `${this.lhs} = ${this.rhs};` + _n;
      }
      optimizeNames(names, constants) {
        if (this.lhs instanceof code_1.Name && !names[this.lhs.str] && !this.sideEffects)
          return;
        this.rhs = optimizeExpr(this.rhs, names, constants);
        return this;
      }
      get names() {
        const names = this.lhs instanceof code_1.Name ? {} : { ...this.lhs.names };
        return addExprNames(names, this.rhs);
      }
    };
    var AssignOp = class extends Assign {
      constructor(lhs, op, rhs, sideEffects) {
        super(lhs, rhs, sideEffects);
        this.op = op;
      }
      render({ _n }) {
        return `${this.lhs} ${this.op}= ${this.rhs};` + _n;
      }
    };
    var Label = class extends Node {
      constructor(label) {
        super();
        this.label = label;
        this.names = {};
      }
      render({ _n }) {
        return `${this.label}:` + _n;
      }
    };
    var Break = class extends Node {
      constructor(label) {
        super();
        this.label = label;
        this.names = {};
      }
      render({ _n }) {
        const label = this.label ? ` ${this.label}` : "";
        return `break${label};` + _n;
      }
    };
    var Throw = class extends Node {
      constructor(error) {
        super();
        this.error = error;
      }
      render({ _n }) {
        return `throw ${this.error};` + _n;
      }
      get names() {
        return this.error.names;
      }
    };
    var AnyCode = class extends Node {
      constructor(code) {
        super();
        this.code = code;
      }
      render({ _n }) {
        return `${this.code};` + _n;
      }
      optimizeNodes() {
        return `${this.code}` ? this : void 0;
      }
      optimizeNames(names, constants) {
        this.code = optimizeExpr(this.code, names, constants);
        return this;
      }
      get names() {
        return this.code instanceof code_1._CodeOrName ? this.code.names : {};
      }
    };
    var ParentNode = class extends Node {
      constructor(nodes = []) {
        super();
        this.nodes = nodes;
      }
      render(opts) {
        return this.nodes.reduce((code, n) => code + n.render(opts), "");
      }
      optimizeNodes() {
        const { nodes } = this;
        let i = nodes.length;
        while (i--) {
          const n = nodes[i].optimizeNodes();
          if (Array.isArray(n))
            nodes.splice(i, 1, ...n);
          else if (n)
            nodes[i] = n;
          else
            nodes.splice(i, 1);
        }
        return nodes.length > 0 ? this : void 0;
      }
      optimizeNames(names, constants) {
        const { nodes } = this;
        let i = nodes.length;
        while (i--) {
          const n = nodes[i];
          if (n.optimizeNames(names, constants))
            continue;
          subtractNames(names, n.names);
          nodes.splice(i, 1);
        }
        return nodes.length > 0 ? this : void 0;
      }
      get names() {
        return this.nodes.reduce((names, n) => addNames(names, n.names), {});
      }
    };
    var BlockNode = class extends ParentNode {
      render(opts) {
        return "{" + opts._n + super.render(opts) + "}" + opts._n;
      }
    };
    var Root = class extends ParentNode {
    };
    var Else = class extends BlockNode {
    };
    Else.kind = "else";
    var If = class _If extends BlockNode {
      constructor(condition, nodes) {
        super(nodes);
        this.condition = condition;
      }
      render(opts) {
        let code = `if(${this.condition})` + super.render(opts);
        if (this.else)
          code += "else " + this.else.render(opts);
        return code;
      }
      optimizeNodes() {
        super.optimizeNodes();
        const cond = this.condition;
        if (cond === true)
          return this.nodes;
        let e = this.else;
        if (e) {
          const ns = e.optimizeNodes();
          e = this.else = Array.isArray(ns) ? new Else(ns) : ns;
        }
        if (e) {
          if (cond === false)
            return e instanceof _If ? e : e.nodes;
          if (this.nodes.length)
            return this;
          return new _If(not(cond), e instanceof _If ? [e] : e.nodes);
        }
        if (cond === false || !this.nodes.length)
          return void 0;
        return this;
      }
      optimizeNames(names, constants) {
        var _a;
        this.else = (_a = this.else) === null || _a === void 0 ? void 0 : _a.optimizeNames(names, constants);
        if (!(super.optimizeNames(names, constants) || this.else))
          return;
        this.condition = optimizeExpr(this.condition, names, constants);
        return this;
      }
      get names() {
        const names = super.names;
        addExprNames(names, this.condition);
        if (this.else)
          addNames(names, this.else.names);
        return names;
      }
    };
    If.kind = "if";
    var For = class extends BlockNode {
    };
    For.kind = "for";
    var ForLoop = class extends For {
      constructor(iteration) {
        super();
        this.iteration = iteration;
      }
      render(opts) {
        return `for(${this.iteration})` + super.render(opts);
      }
      optimizeNames(names, constants) {
        if (!super.optimizeNames(names, constants))
          return;
        this.iteration = optimizeExpr(this.iteration, names, constants);
        return this;
      }
      get names() {
        return addNames(super.names, this.iteration.names);
      }
    };
    var ForRange = class extends For {
      constructor(varKind, name2, from, to) {
        super();
        this.varKind = varKind;
        this.name = name2;
        this.from = from;
        this.to = to;
      }
      render(opts) {
        const varKind = opts.es5 ? scope_1.varKinds.var : this.varKind;
        const { name: name2, from, to } = this;
        return `for(${varKind} ${name2}=${from}; ${name2}<${to}; ${name2}++)` + super.render(opts);
      }
      get names() {
        const names = addExprNames(super.names, this.from);
        return addExprNames(names, this.to);
      }
    };
    var ForIter = class extends For {
      constructor(loop, varKind, name2, iterable) {
        super();
        this.loop = loop;
        this.varKind = varKind;
        this.name = name2;
        this.iterable = iterable;
      }
      render(opts) {
        return `for(${this.varKind} ${this.name} ${this.loop} ${this.iterable})` + super.render(opts);
      }
      optimizeNames(names, constants) {
        if (!super.optimizeNames(names, constants))
          return;
        this.iterable = optimizeExpr(this.iterable, names, constants);
        return this;
      }
      get names() {
        return addNames(super.names, this.iterable.names);
      }
    };
    var Func = class extends BlockNode {
      constructor(name2, args, async) {
        super();
        this.name = name2;
        this.args = args;
        this.async = async;
      }
      render(opts) {
        const _async = this.async ? "async " : "";
        return `${_async}function ${this.name}(${this.args})` + super.render(opts);
      }
    };
    Func.kind = "func";
    var Return = class extends ParentNode {
      render(opts) {
        return "return " + super.render(opts);
      }
    };
    Return.kind = "return";
    var Try = class extends BlockNode {
      render(opts) {
        let code = "try" + super.render(opts);
        if (this.catch)
          code += this.catch.render(opts);
        if (this.finally)
          code += this.finally.render(opts);
        return code;
      }
      optimizeNodes() {
        var _a, _b;
        super.optimizeNodes();
        (_a = this.catch) === null || _a === void 0 ? void 0 : _a.optimizeNodes();
        (_b = this.finally) === null || _b === void 0 ? void 0 : _b.optimizeNodes();
        return this;
      }
      optimizeNames(names, constants) {
        var _a, _b;
        super.optimizeNames(names, constants);
        (_a = this.catch) === null || _a === void 0 ? void 0 : _a.optimizeNames(names, constants);
        (_b = this.finally) === null || _b === void 0 ? void 0 : _b.optimizeNames(names, constants);
        return this;
      }
      get names() {
        const names = super.names;
        if (this.catch)
          addNames(names, this.catch.names);
        if (this.finally)
          addNames(names, this.finally.names);
        return names;
      }
    };
    var Catch = class extends BlockNode {
      constructor(error) {
        super();
        this.error = error;
      }
      render(opts) {
        return `catch(${this.error})` + super.render(opts);
      }
    };
    Catch.kind = "catch";
    var Finally = class extends BlockNode {
      render(opts) {
        return "finally" + super.render(opts);
      }
    };
    Finally.kind = "finally";
    var CodeGen = class {
      constructor(extScope, opts = {}) {
        this._values = {};
        this._blockStarts = [];
        this._constants = {};
        this.opts = { ...opts, _n: opts.lines ? "\n" : "" };
        this._extScope = extScope;
        this._scope = new scope_1.Scope({ parent: extScope });
        this._nodes = [new Root()];
      }
      toString() {
        return this._root.render(this.opts);
      }
      // returns unique name in the internal scope
      name(prefix) {
        return this._scope.name(prefix);
      }
      // reserves unique name in the external scope
      scopeName(prefix) {
        return this._extScope.name(prefix);
      }
      // reserves unique name in the external scope and assigns value to it
      scopeValue(prefixOrName, value) {
        const name2 = this._extScope.value(prefixOrName, value);
        const vs = this._values[name2.prefix] || (this._values[name2.prefix] = /* @__PURE__ */ new Set());
        vs.add(name2);
        return name2;
      }
      getScopeValue(prefix, keyOrRef) {
        return this._extScope.getValue(prefix, keyOrRef);
      }
      // return code that assigns values in the external scope to the names that are used internally
      // (same names that were returned by gen.scopeName or gen.scopeValue)
      scopeRefs(scopeName) {
        return this._extScope.scopeRefs(scopeName, this._values);
      }
      scopeCode() {
        return this._extScope.scopeCode(this._values);
      }
      _def(varKind, nameOrPrefix, rhs, constant) {
        const name2 = this._scope.toName(nameOrPrefix);
        if (rhs !== void 0 && constant)
          this._constants[name2.str] = rhs;
        this._leafNode(new Def(varKind, name2, rhs));
        return name2;
      }
      // `const` declaration (`var` in es5 mode)
      const(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.const, nameOrPrefix, rhs, _constant);
      }
      // `let` declaration with optional assignment (`var` in es5 mode)
      let(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.let, nameOrPrefix, rhs, _constant);
      }
      // `var` declaration with optional assignment
      var(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.var, nameOrPrefix, rhs, _constant);
      }
      // assignment code
      assign(lhs, rhs, sideEffects) {
        return this._leafNode(new Assign(lhs, rhs, sideEffects));
      }
      // `+=` code
      add(lhs, rhs) {
        return this._leafNode(new AssignOp(lhs, exports.operators.ADD, rhs));
      }
      // appends passed SafeExpr to code or executes Block
      code(c) {
        if (typeof c == "function")
          c();
        else if (c !== code_1.nil)
          this._leafNode(new AnyCode(c));
        return this;
      }
      // returns code for object literal for the passed argument list of key-value pairs
      object(...keyValues) {
        const code = ["{"];
        for (const [key, value] of keyValues) {
          if (code.length > 1)
            code.push(",");
          code.push(key);
          if (key !== value || this.opts.es5) {
            code.push(":");
            (0, code_1.addCodeArg)(code, value);
          }
        }
        code.push("}");
        return new code_1._Code(code);
      }
      // `if` clause (or statement if `thenBody` and, optionally, `elseBody` are passed)
      if(condition, thenBody, elseBody) {
        this._blockNode(new If(condition));
        if (thenBody && elseBody) {
          this.code(thenBody).else().code(elseBody).endIf();
        } else if (thenBody) {
          this.code(thenBody).endIf();
        } else if (elseBody) {
          throw new Error('CodeGen: "else" body without "then" body');
        }
        return this;
      }
      // `else if` clause - invalid without `if` or after `else` clauses
      elseIf(condition) {
        return this._elseNode(new If(condition));
      }
      // `else` clause - only valid after `if` or `else if` clauses
      else() {
        return this._elseNode(new Else());
      }
      // end `if` statement (needed if gen.if was used only with condition)
      endIf() {
        return this._endBlockNode(If, Else);
      }
      _for(node, forBody) {
        this._blockNode(node);
        if (forBody)
          this.code(forBody).endFor();
        return this;
      }
      // a generic `for` clause (or statement if `forBody` is passed)
      for(iteration, forBody) {
        return this._for(new ForLoop(iteration), forBody);
      }
      // `for` statement for a range of values
      forRange(nameOrPrefix, from, to, forBody, varKind = this.opts.es5 ? scope_1.varKinds.var : scope_1.varKinds.let) {
        const name2 = this._scope.toName(nameOrPrefix);
        return this._for(new ForRange(varKind, name2, from, to), () => forBody(name2));
      }
      // `for-of` statement (in es5 mode replace with a normal for loop)
      forOf(nameOrPrefix, iterable, forBody, varKind = scope_1.varKinds.const) {
        const name2 = this._scope.toName(nameOrPrefix);
        if (this.opts.es5) {
          const arr = iterable instanceof code_1.Name ? iterable : this.var("_arr", iterable);
          return this.forRange("_i", 0, (0, code_1._)`${arr}.length`, (i) => {
            this.var(name2, (0, code_1._)`${arr}[${i}]`);
            forBody(name2);
          });
        }
        return this._for(new ForIter("of", varKind, name2, iterable), () => forBody(name2));
      }
      // `for-in` statement.
      // With option `ownProperties` replaced with a `for-of` loop for object keys
      forIn(nameOrPrefix, obj, forBody, varKind = this.opts.es5 ? scope_1.varKinds.var : scope_1.varKinds.const) {
        if (this.opts.ownProperties) {
          return this.forOf(nameOrPrefix, (0, code_1._)`Object.keys(${obj})`, forBody);
        }
        const name2 = this._scope.toName(nameOrPrefix);
        return this._for(new ForIter("in", varKind, name2, obj), () => forBody(name2));
      }
      // end `for` loop
      endFor() {
        return this._endBlockNode(For);
      }
      // `label` statement
      label(label) {
        return this._leafNode(new Label(label));
      }
      // `break` statement
      break(label) {
        return this._leafNode(new Break(label));
      }
      // `return` statement
      return(value) {
        const node = new Return();
        this._blockNode(node);
        this.code(value);
        if (node.nodes.length !== 1)
          throw new Error('CodeGen: "return" should have one node');
        return this._endBlockNode(Return);
      }
      // `try` statement
      try(tryBody, catchCode, finallyCode) {
        if (!catchCode && !finallyCode)
          throw new Error('CodeGen: "try" without "catch" and "finally"');
        const node = new Try();
        this._blockNode(node);
        this.code(tryBody);
        if (catchCode) {
          const error = this.name("e");
          this._currNode = node.catch = new Catch(error);
          catchCode(error);
        }
        if (finallyCode) {
          this._currNode = node.finally = new Finally();
          this.code(finallyCode);
        }
        return this._endBlockNode(Catch, Finally);
      }
      // `throw` statement
      throw(error) {
        return this._leafNode(new Throw(error));
      }
      // start self-balancing block
      block(body, nodeCount) {
        this._blockStarts.push(this._nodes.length);
        if (body)
          this.code(body).endBlock(nodeCount);
        return this;
      }
      // end the current self-balancing block
      endBlock(nodeCount) {
        const len = this._blockStarts.pop();
        if (len === void 0)
          throw new Error("CodeGen: not in self-balancing block");
        const toClose = this._nodes.length - len;
        if (toClose < 0 || nodeCount !== void 0 && toClose !== nodeCount) {
          throw new Error(`CodeGen: wrong number of nodes: ${toClose} vs ${nodeCount} expected`);
        }
        this._nodes.length = len;
        return this;
      }
      // `function` heading (or definition if funcBody is passed)
      func(name2, args = code_1.nil, async, funcBody) {
        this._blockNode(new Func(name2, args, async));
        if (funcBody)
          this.code(funcBody).endFunc();
        return this;
      }
      // end function definition
      endFunc() {
        return this._endBlockNode(Func);
      }
      optimize(n = 1) {
        while (n-- > 0) {
          this._root.optimizeNodes();
          this._root.optimizeNames(this._root.names, this._constants);
        }
      }
      _leafNode(node) {
        this._currNode.nodes.push(node);
        return this;
      }
      _blockNode(node) {
        this._currNode.nodes.push(node);
        this._nodes.push(node);
      }
      _endBlockNode(N1, N2) {
        const n = this._currNode;
        if (n instanceof N1 || N2 && n instanceof N2) {
          this._nodes.pop();
          return this;
        }
        throw new Error(`CodeGen: not in block "${N2 ? `${N1.kind}/${N2.kind}` : N1.kind}"`);
      }
      _elseNode(node) {
        const n = this._currNode;
        if (!(n instanceof If)) {
          throw new Error('CodeGen: "else" without "if"');
        }
        this._currNode = n.else = node;
        return this;
      }
      get _root() {
        return this._nodes[0];
      }
      get _currNode() {
        const ns = this._nodes;
        return ns[ns.length - 1];
      }
      set _currNode(node) {
        const ns = this._nodes;
        ns[ns.length - 1] = node;
      }
    };
    exports.CodeGen = CodeGen;
    function addNames(names, from) {
      for (const n in from)
        names[n] = (names[n] || 0) + (from[n] || 0);
      return names;
    }
    function addExprNames(names, from) {
      return from instanceof code_1._CodeOrName ? addNames(names, from.names) : names;
    }
    function optimizeExpr(expr, names, constants) {
      if (expr instanceof code_1.Name)
        return replaceName(expr);
      if (!canOptimize(expr))
        return expr;
      return new code_1._Code(expr._items.reduce((items, c) => {
        if (c instanceof code_1.Name)
          c = replaceName(c);
        if (c instanceof code_1._Code)
          items.push(...c._items);
        else
          items.push(c);
        return items;
      }, []));
      function replaceName(n) {
        const c = constants[n.str];
        if (c === void 0 || names[n.str] !== 1)
          return n;
        delete names[n.str];
        return c;
      }
      function canOptimize(e) {
        return e instanceof code_1._Code && e._items.some((c) => c instanceof code_1.Name && names[c.str] === 1 && constants[c.str] !== void 0);
      }
    }
    function subtractNames(names, from) {
      for (const n in from)
        names[n] = (names[n] || 0) - (from[n] || 0);
    }
    function not(x) {
      return typeof x == "boolean" || typeof x == "number" || x === null ? !x : (0, code_1._)`!${par(x)}`;
    }
    exports.not = not;
    var andCode = mappend(exports.operators.AND);
    function and(...args) {
      return args.reduce(andCode);
    }
    exports.and = and;
    var orCode = mappend(exports.operators.OR);
    function or(...args) {
      return args.reduce(orCode);
    }
    exports.or = or;
    function mappend(op) {
      return (x, y) => x === code_1.nil ? y : y === code_1.nil ? x : (0, code_1._)`${par(x)} ${op} ${par(y)}`;
    }
    function par(x) {
      return x instanceof code_1.Name ? x : (0, code_1._)`(${x})`;
    }
  }
});

// node_modules/ajv/dist/compile/util.js
var require_util = __commonJS({
  "node_modules/ajv/dist/compile/util.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.checkStrictMode = exports.getErrorPath = exports.Type = exports.useFunc = exports.setEvaluated = exports.evaluatedPropsToName = exports.mergeEvaluated = exports.eachItem = exports.unescapeJsonPointer = exports.escapeJsonPointer = exports.escapeFragment = exports.unescapeFragment = exports.schemaRefOrVal = exports.schemaHasRulesButRef = exports.schemaHasRules = exports.checkUnknownRules = exports.alwaysValidSchema = exports.toHash = void 0;
    var codegen_1 = require_codegen();
    var code_1 = require_code();
    function toHash(arr) {
      const hash = {};
      for (const item of arr)
        hash[item] = true;
      return hash;
    }
    exports.toHash = toHash;
    function alwaysValidSchema(it, schema2) {
      if (typeof schema2 == "boolean")
        return schema2;
      if (Object.keys(schema2).length === 0)
        return true;
      checkUnknownRules(it, schema2);
      return !schemaHasRules(schema2, it.self.RULES.all);
    }
    exports.alwaysValidSchema = alwaysValidSchema;
    function checkUnknownRules(it, schema2 = it.schema) {
      const { opts, self } = it;
      if (!opts.strictSchema)
        return;
      if (typeof schema2 === "boolean")
        return;
      const rules = self.RULES.keywords;
      for (const key in schema2) {
        if (!rules[key])
          checkStrictMode(it, `unknown keyword: "${key}"`);
      }
    }
    exports.checkUnknownRules = checkUnknownRules;
    function schemaHasRules(schema2, rules) {
      if (typeof schema2 == "boolean")
        return !schema2;
      for (const key in schema2)
        if (rules[key])
          return true;
      return false;
    }
    exports.schemaHasRules = schemaHasRules;
    function schemaHasRulesButRef(schema2, RULES2) {
      if (typeof schema2 == "boolean")
        return !schema2;
      for (const key in schema2)
        if (key !== "$ref" && RULES2.all[key])
          return true;
      return false;
    }
    exports.schemaHasRulesButRef = schemaHasRulesButRef;
    function schemaRefOrVal({ topSchemaRef, schemaPath }, schema2, keyword, $data) {
      if (!$data) {
        if (typeof schema2 == "number" || typeof schema2 == "boolean")
          return schema2;
        if (typeof schema2 == "string")
          return (0, codegen_1._)`${schema2}`;
      }
      return (0, codegen_1._)`${topSchemaRef}${schemaPath}${(0, codegen_1.getProperty)(keyword)}`;
    }
    exports.schemaRefOrVal = schemaRefOrVal;
    function unescapeFragment(str) {
      return unescapeJsonPointer(decodeURIComponent(str));
    }
    exports.unescapeFragment = unescapeFragment;
    function escapeFragment(str) {
      return encodeURIComponent(escapeJsonPointer(str));
    }
    exports.escapeFragment = escapeFragment;
    function escapeJsonPointer(str) {
      if (typeof str == "number")
        return `${str}`;
      return str.replace(/~/g, "~0").replace(/\//g, "~1");
    }
    exports.escapeJsonPointer = escapeJsonPointer;
    function unescapeJsonPointer(str) {
      return str.replace(/~1/g, "/").replace(/~0/g, "~");
    }
    exports.unescapeJsonPointer = unescapeJsonPointer;
    function eachItem(xs, f) {
      if (Array.isArray(xs)) {
        for (const x of xs)
          f(x);
      } else {
        f(xs);
      }
    }
    exports.eachItem = eachItem;
    function makeMergeEvaluated({ mergeNames, mergeToName, mergeValues, resultToName }) {
      return (gen, from, to, toName) => {
        const res = to === void 0 ? from : to instanceof codegen_1.Name ? (from instanceof codegen_1.Name ? mergeNames(gen, from, to) : mergeToName(gen, from, to), to) : from instanceof codegen_1.Name ? (mergeToName(gen, to, from), from) : mergeValues(from, to);
        return toName === codegen_1.Name && !(res instanceof codegen_1.Name) ? resultToName(gen, res) : res;
      };
    }
    exports.mergeEvaluated = {
      props: makeMergeEvaluated({
        mergeNames: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true && ${from} !== undefined`, () => {
          gen.if((0, codegen_1._)`${from} === true`, () => gen.assign(to, true), () => gen.assign(to, (0, codegen_1._)`${to} || {}`).code((0, codegen_1._)`Object.assign(${to}, ${from})`));
        }),
        mergeToName: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true`, () => {
          if (from === true) {
            gen.assign(to, true);
          } else {
            gen.assign(to, (0, codegen_1._)`${to} || {}`);
            setEvaluated(gen, to, from);
          }
        }),
        mergeValues: (from, to) => from === true ? true : { ...from, ...to },
        resultToName: evaluatedPropsToName
      }),
      items: makeMergeEvaluated({
        mergeNames: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true && ${from} !== undefined`, () => gen.assign(to, (0, codegen_1._)`${from} === true ? true : ${to} > ${from} ? ${to} : ${from}`)),
        mergeToName: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true`, () => gen.assign(to, from === true ? true : (0, codegen_1._)`${to} > ${from} ? ${to} : ${from}`)),
        mergeValues: (from, to) => from === true ? true : Math.max(from, to),
        resultToName: (gen, items) => gen.var("items", items)
      })
    };
    function evaluatedPropsToName(gen, ps) {
      if (ps === true)
        return gen.var("props", true);
      const props = gen.var("props", (0, codegen_1._)`{}`);
      if (ps !== void 0)
        setEvaluated(gen, props, ps);
      return props;
    }
    exports.evaluatedPropsToName = evaluatedPropsToName;
    function setEvaluated(gen, props, ps) {
      Object.keys(ps).forEach((p) => gen.assign((0, codegen_1._)`${props}${(0, codegen_1.getProperty)(p)}`, true));
    }
    exports.setEvaluated = setEvaluated;
    var snippets = {};
    function useFunc(gen, f) {
      return gen.scopeValue("func", {
        ref: f,
        code: snippets[f.code] || (snippets[f.code] = new code_1._Code(f.code))
      });
    }
    exports.useFunc = useFunc;
    var Type;
    (function(Type2) {
      Type2[Type2["Num"] = 0] = "Num";
      Type2[Type2["Str"] = 1] = "Str";
    })(Type || (exports.Type = Type = {}));
    function getErrorPath(dataProp, dataPropType, jsPropertySyntax) {
      if (dataProp instanceof codegen_1.Name) {
        const isNumber = dataPropType === Type.Num;
        return jsPropertySyntax ? isNumber ? (0, codegen_1._)`"[" + ${dataProp} + "]"` : (0, codegen_1._)`"['" + ${dataProp} + "']"` : isNumber ? (0, codegen_1._)`"/" + ${dataProp}` : (0, codegen_1._)`"/" + ${dataProp}.replace(/~/g, "~0").replace(/\\//g, "~1")`;
      }
      return jsPropertySyntax ? (0, codegen_1.getProperty)(dataProp).toString() : "/" + escapeJsonPointer(dataProp);
    }
    exports.getErrorPath = getErrorPath;
    function checkStrictMode(it, msg, mode = it.opts.strictSchema) {
      if (!mode)
        return;
      msg = `strict mode: ${msg}`;
      if (mode === true)
        throw new Error(msg);
      it.self.logger.warn(msg);
    }
    exports.checkStrictMode = checkStrictMode;
  }
});

// node_modules/ajv/dist/compile/names.js
var require_names = __commonJS({
  "node_modules/ajv/dist/compile/names.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var names = {
      // validation function arguments
      data: new codegen_1.Name("data"),
      // data passed to validation function
      // args passed from referencing schema
      valCxt: new codegen_1.Name("valCxt"),
      // validation/data context - should not be used directly, it is destructured to the names below
      instancePath: new codegen_1.Name("instancePath"),
      parentData: new codegen_1.Name("parentData"),
      parentDataProperty: new codegen_1.Name("parentDataProperty"),
      rootData: new codegen_1.Name("rootData"),
      // root data - same as the data passed to the first/top validation function
      dynamicAnchors: new codegen_1.Name("dynamicAnchors"),
      // used to support recursiveRef and dynamicRef
      // function scoped variables
      vErrors: new codegen_1.Name("vErrors"),
      // null or array of validation errors
      errors: new codegen_1.Name("errors"),
      // counter of validation errors
      this: new codegen_1.Name("this"),
      // "globals"
      self: new codegen_1.Name("self"),
      scope: new codegen_1.Name("scope"),
      // JTD serialize/parse name for JSON string and position
      json: new codegen_1.Name("json"),
      jsonPos: new codegen_1.Name("jsonPos"),
      jsonLen: new codegen_1.Name("jsonLen"),
      jsonPart: new codegen_1.Name("jsonPart")
    };
    exports.default = names;
  }
});

// node_modules/ajv/dist/compile/errors.js
var require_errors2 = __commonJS({
  "node_modules/ajv/dist/compile/errors.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.extendErrors = exports.resetErrorsCount = exports.reportExtraError = exports.reportError = exports.keyword$DataError = exports.keywordError = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var names_1 = require_names();
    exports.keywordError = {
      message: ({ keyword }) => (0, codegen_1.str)`must pass "${keyword}" keyword validation`
    };
    exports.keyword$DataError = {
      message: ({ keyword, schemaType }) => schemaType ? (0, codegen_1.str)`"${keyword}" keyword must be ${schemaType} ($data)` : (0, codegen_1.str)`"${keyword}" keyword is invalid ($data)`
    };
    function reportError(cxt, error = exports.keywordError, errorPaths, overrideAllErrors) {
      const { it } = cxt;
      const { gen, compositeRule, allErrors } = it;
      const errObj = errorObjectCode(cxt, error, errorPaths);
      if (overrideAllErrors !== null && overrideAllErrors !== void 0 ? overrideAllErrors : compositeRule || allErrors) {
        addError(gen, errObj);
      } else {
        returnErrors(it, (0, codegen_1._)`[${errObj}]`);
      }
    }
    exports.reportError = reportError;
    function reportExtraError(cxt, error = exports.keywordError, errorPaths) {
      const { it } = cxt;
      const { gen, compositeRule, allErrors } = it;
      const errObj = errorObjectCode(cxt, error, errorPaths);
      addError(gen, errObj);
      if (!(compositeRule || allErrors)) {
        returnErrors(it, names_1.default.vErrors);
      }
    }
    exports.reportExtraError = reportExtraError;
    function resetErrorsCount(gen, errsCount) {
      gen.assign(names_1.default.errors, errsCount);
      gen.if((0, codegen_1._)`${names_1.default.vErrors} !== null`, () => gen.if(errsCount, () => gen.assign((0, codegen_1._)`${names_1.default.vErrors}.length`, errsCount), () => gen.assign(names_1.default.vErrors, null)));
    }
    exports.resetErrorsCount = resetErrorsCount;
    function extendErrors({ gen, keyword, schemaValue, data, errsCount, it }) {
      if (errsCount === void 0)
        throw new Error("ajv implementation error");
      const err = gen.name("err");
      gen.forRange("i", errsCount, names_1.default.errors, (i) => {
        gen.const(err, (0, codegen_1._)`${names_1.default.vErrors}[${i}]`);
        gen.if((0, codegen_1._)`${err}.instancePath === undefined`, () => gen.assign((0, codegen_1._)`${err}.instancePath`, (0, codegen_1.strConcat)(names_1.default.instancePath, it.errorPath)));
        gen.assign((0, codegen_1._)`${err}.schemaPath`, (0, codegen_1.str)`${it.errSchemaPath}/${keyword}`);
        if (it.opts.verbose) {
          gen.assign((0, codegen_1._)`${err}.schema`, schemaValue);
          gen.assign((0, codegen_1._)`${err}.data`, data);
        }
      });
    }
    exports.extendErrors = extendErrors;
    function addError(gen, errObj) {
      const err = gen.const("err", errObj);
      gen.if((0, codegen_1._)`${names_1.default.vErrors} === null`, () => gen.assign(names_1.default.vErrors, (0, codegen_1._)`[${err}]`), (0, codegen_1._)`${names_1.default.vErrors}.push(${err})`);
      gen.code((0, codegen_1._)`${names_1.default.errors}++`);
    }
    function returnErrors(it, errs) {
      const { gen, validateName, schemaEnv } = it;
      if (schemaEnv.$async) {
        gen.throw((0, codegen_1._)`new ${it.ValidationError}(${errs})`);
      } else {
        gen.assign((0, codegen_1._)`${validateName}.errors`, errs);
        gen.return(false);
      }
    }
    var E = {
      keyword: new codegen_1.Name("keyword"),
      schemaPath: new codegen_1.Name("schemaPath"),
      // also used in JTD errors
      params: new codegen_1.Name("params"),
      propertyName: new codegen_1.Name("propertyName"),
      message: new codegen_1.Name("message"),
      schema: new codegen_1.Name("schema"),
      parentSchema: new codegen_1.Name("parentSchema")
    };
    function errorObjectCode(cxt, error, errorPaths) {
      const { createErrors } = cxt.it;
      if (createErrors === false)
        return (0, codegen_1._)`{}`;
      return errorObject(cxt, error, errorPaths);
    }
    function errorObject(cxt, error, errorPaths = {}) {
      const { gen, it } = cxt;
      const keyValues = [
        errorInstancePath(it, errorPaths),
        errorSchemaPath(cxt, errorPaths)
      ];
      extraErrorProps(cxt, error, keyValues);
      return gen.object(...keyValues);
    }
    function errorInstancePath({ errorPath }, { instancePath }) {
      const instPath = instancePath ? (0, codegen_1.str)`${errorPath}${(0, util_1.getErrorPath)(instancePath, util_1.Type.Str)}` : errorPath;
      return [names_1.default.instancePath, (0, codegen_1.strConcat)(names_1.default.instancePath, instPath)];
    }
    function errorSchemaPath({ keyword, it: { errSchemaPath } }, { schemaPath, parentSchema }) {
      let schPath = parentSchema ? errSchemaPath : (0, codegen_1.str)`${errSchemaPath}/${keyword}`;
      if (schemaPath) {
        schPath = (0, codegen_1.str)`${schPath}${(0, util_1.getErrorPath)(schemaPath, util_1.Type.Str)}`;
      }
      return [E.schemaPath, schPath];
    }
    function extraErrorProps(cxt, { params, message }, keyValues) {
      const { keyword, data, schemaValue, it } = cxt;
      const { opts, propertyName, topSchemaRef, schemaPath } = it;
      keyValues.push([E.keyword, keyword], [E.params, typeof params == "function" ? params(cxt) : params || (0, codegen_1._)`{}`]);
      if (opts.messages) {
        keyValues.push([E.message, typeof message == "function" ? message(cxt) : message]);
      }
      if (opts.verbose) {
        keyValues.push([E.schema, schemaValue], [E.parentSchema, (0, codegen_1._)`${topSchemaRef}${schemaPath}`], [names_1.default.data, data]);
      }
      if (propertyName)
        keyValues.push([E.propertyName, propertyName]);
    }
  }
});

// node_modules/ajv/dist/compile/validate/boolSchema.js
var require_boolSchema = __commonJS({
  "node_modules/ajv/dist/compile/validate/boolSchema.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.boolOrEmptySchema = exports.topBoolOrEmptySchema = void 0;
    var errors_1 = require_errors2();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var boolError = {
      message: "boolean schema is false"
    };
    function topBoolOrEmptySchema(it) {
      const { gen, schema: schema2, validateName } = it;
      if (schema2 === false) {
        falseSchemaError(it, false);
      } else if (typeof schema2 == "object" && schema2.$async === true) {
        gen.return(names_1.default.data);
      } else {
        gen.assign((0, codegen_1._)`${validateName}.errors`, null);
        gen.return(true);
      }
    }
    exports.topBoolOrEmptySchema = topBoolOrEmptySchema;
    function boolOrEmptySchema(it, valid) {
      const { gen, schema: schema2 } = it;
      if (schema2 === false) {
        gen.var(valid, false);
        falseSchemaError(it);
      } else {
        gen.var(valid, true);
      }
    }
    exports.boolOrEmptySchema = boolOrEmptySchema;
    function falseSchemaError(it, overrideAllErrors) {
      const { gen, data } = it;
      const cxt = {
        gen,
        keyword: "false schema",
        data,
        schema: false,
        schemaCode: false,
        schemaValue: false,
        params: {},
        it
      };
      (0, errors_1.reportError)(cxt, boolError, void 0, overrideAllErrors);
    }
  }
});

// node_modules/ajv/dist/compile/rules.js
var require_rules = __commonJS({
  "node_modules/ajv/dist/compile/rules.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getRules = exports.isJSONType = void 0;
    var _jsonTypes = ["string", "number", "integer", "boolean", "null", "object", "array"];
    var jsonTypes = new Set(_jsonTypes);
    function isJSONType(x) {
      return typeof x == "string" && jsonTypes.has(x);
    }
    exports.isJSONType = isJSONType;
    function getRules() {
      const groups = {
        number: { type: "number", rules: [] },
        string: { type: "string", rules: [] },
        array: { type: "array", rules: [] },
        object: { type: "object", rules: [] }
      };
      return {
        types: { ...groups, integer: true, boolean: true, null: true },
        rules: [{ rules: [] }, groups.number, groups.string, groups.array, groups.object],
        post: { rules: [] },
        all: {},
        keywords: {}
      };
    }
    exports.getRules = getRules;
  }
});

// node_modules/ajv/dist/compile/validate/applicability.js
var require_applicability = __commonJS({
  "node_modules/ajv/dist/compile/validate/applicability.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.shouldUseRule = exports.shouldUseGroup = exports.schemaHasRulesForType = void 0;
    function schemaHasRulesForType({ schema: schema2, self }, type) {
      const group = self.RULES.types[type];
      return group && group !== true && shouldUseGroup(schema2, group);
    }
    exports.schemaHasRulesForType = schemaHasRulesForType;
    function shouldUseGroup(schema2, group) {
      return group.rules.some((rule) => shouldUseRule(schema2, rule));
    }
    exports.shouldUseGroup = shouldUseGroup;
    function shouldUseRule(schema2, rule) {
      var _a;
      return schema2[rule.keyword] !== void 0 || ((_a = rule.definition.implements) === null || _a === void 0 ? void 0 : _a.some((kwd) => schema2[kwd] !== void 0));
    }
    exports.shouldUseRule = shouldUseRule;
  }
});

// node_modules/ajv/dist/compile/validate/dataType.js
var require_dataType = __commonJS({
  "node_modules/ajv/dist/compile/validate/dataType.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.reportTypeError = exports.checkDataTypes = exports.checkDataType = exports.coerceAndCheckDataType = exports.getJSONTypes = exports.getSchemaTypes = exports.DataType = void 0;
    var rules_1 = require_rules();
    var applicability_1 = require_applicability();
    var errors_1 = require_errors2();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var DataType;
    (function(DataType2) {
      DataType2[DataType2["Correct"] = 0] = "Correct";
      DataType2[DataType2["Wrong"] = 1] = "Wrong";
    })(DataType || (exports.DataType = DataType = {}));
    function getSchemaTypes(schema2) {
      const types = getJSONTypes(schema2.type);
      const hasNull = types.includes("null");
      if (hasNull) {
        if (schema2.nullable === false)
          throw new Error("type: null contradicts nullable: false");
      } else {
        if (!types.length && schema2.nullable !== void 0) {
          throw new Error('"nullable" cannot be used without "type"');
        }
        if (schema2.nullable === true)
          types.push("null");
      }
      return types;
    }
    exports.getSchemaTypes = getSchemaTypes;
    function getJSONTypes(ts) {
      const types = Array.isArray(ts) ? ts : ts ? [ts] : [];
      if (types.every(rules_1.isJSONType))
        return types;
      throw new Error("type must be JSONType or JSONType[]: " + types.join(","));
    }
    exports.getJSONTypes = getJSONTypes;
    function coerceAndCheckDataType(it, types) {
      const { gen, data, opts } = it;
      const coerceTo = coerceToTypes(types, opts.coerceTypes);
      const checkTypes = types.length > 0 && !(coerceTo.length === 0 && types.length === 1 && (0, applicability_1.schemaHasRulesForType)(it, types[0]));
      if (checkTypes) {
        const wrongType = checkDataTypes(types, data, opts.strictNumbers, DataType.Wrong);
        gen.if(wrongType, () => {
          if (coerceTo.length)
            coerceData(it, types, coerceTo);
          else
            reportTypeError(it);
        });
      }
      return checkTypes;
    }
    exports.coerceAndCheckDataType = coerceAndCheckDataType;
    var COERCIBLE = /* @__PURE__ */ new Set(["string", "number", "integer", "boolean", "null"]);
    function coerceToTypes(types, coerceTypes2) {
      return coerceTypes2 ? types.filter((t) => COERCIBLE.has(t) || coerceTypes2 === "array" && t === "array") : [];
    }
    function coerceData(it, types, coerceTo) {
      const { gen, data, opts } = it;
      const dataType = gen.let("dataType", (0, codegen_1._)`typeof ${data}`);
      const coerced = gen.let("coerced", (0, codegen_1._)`undefined`);
      if (opts.coerceTypes === "array") {
        gen.if((0, codegen_1._)`${dataType} == 'object' && Array.isArray(${data}) && ${data}.length == 1`, () => gen.assign(data, (0, codegen_1._)`${data}[0]`).assign(dataType, (0, codegen_1._)`typeof ${data}`).if(checkDataTypes(types, data, opts.strictNumbers), () => gen.assign(coerced, data)));
      }
      gen.if((0, codegen_1._)`${coerced} !== undefined`);
      for (const t of coerceTo) {
        if (COERCIBLE.has(t) || t === "array" && opts.coerceTypes === "array") {
          coerceSpecificType(t);
        }
      }
      gen.else();
      reportTypeError(it);
      gen.endIf();
      gen.if((0, codegen_1._)`${coerced} !== undefined`, () => {
        gen.assign(data, coerced);
        assignParentData(it, coerced);
      });
      function coerceSpecificType(t) {
        switch (t) {
          case "string":
            gen.elseIf((0, codegen_1._)`${dataType} == "number" || ${dataType} == "boolean"`).assign(coerced, (0, codegen_1._)`"" + ${data}`).elseIf((0, codegen_1._)`${data} === null`).assign(coerced, (0, codegen_1._)`""`);
            return;
          case "number":
            gen.elseIf((0, codegen_1._)`${dataType} == "boolean" || ${data} === null
              || (${dataType} == "string" && ${data} && ${data} == +${data})`).assign(coerced, (0, codegen_1._)`+${data}`);
            return;
          case "integer":
            gen.elseIf((0, codegen_1._)`${dataType} === "boolean" || ${data} === null
              || (${dataType} === "string" && ${data} && ${data} == +${data} && !(${data} % 1))`).assign(coerced, (0, codegen_1._)`+${data}`);
            return;
          case "boolean":
            gen.elseIf((0, codegen_1._)`${data} === "false" || ${data} === 0 || ${data} === null`).assign(coerced, false).elseIf((0, codegen_1._)`${data} === "true" || ${data} === 1`).assign(coerced, true);
            return;
          case "null":
            gen.elseIf((0, codegen_1._)`${data} === "" || ${data} === 0 || ${data} === false`);
            gen.assign(coerced, null);
            return;
          case "array":
            gen.elseIf((0, codegen_1._)`${dataType} === "string" || ${dataType} === "number"
              || ${dataType} === "boolean" || ${data} === null`).assign(coerced, (0, codegen_1._)`[${data}]`);
        }
      }
    }
    function assignParentData({ gen, parentData, parentDataProperty }, expr) {
      gen.if((0, codegen_1._)`${parentData} !== undefined`, () => gen.assign((0, codegen_1._)`${parentData}[${parentDataProperty}]`, expr));
    }
    function checkDataType(dataType, data, strictNums, correct = DataType.Correct) {
      const EQ = correct === DataType.Correct ? codegen_1.operators.EQ : codegen_1.operators.NEQ;
      let cond;
      switch (dataType) {
        case "null":
          return (0, codegen_1._)`${data} ${EQ} null`;
        case "array":
          cond = (0, codegen_1._)`Array.isArray(${data})`;
          break;
        case "object":
          cond = (0, codegen_1._)`${data} && typeof ${data} == "object" && !Array.isArray(${data})`;
          break;
        case "integer":
          cond = numCond((0, codegen_1._)`!(${data} % 1) && !isNaN(${data})`);
          break;
        case "number":
          cond = numCond();
          break;
        default:
          return (0, codegen_1._)`typeof ${data} ${EQ} ${dataType}`;
      }
      return correct === DataType.Correct ? cond : (0, codegen_1.not)(cond);
      function numCond(_cond = codegen_1.nil) {
        return (0, codegen_1.and)((0, codegen_1._)`typeof ${data} == "number"`, _cond, strictNums ? (0, codegen_1._)`isFinite(${data})` : codegen_1.nil);
      }
    }
    exports.checkDataType = checkDataType;
    function checkDataTypes(dataTypes, data, strictNums, correct) {
      if (dataTypes.length === 1) {
        return checkDataType(dataTypes[0], data, strictNums, correct);
      }
      let cond;
      const types = (0, util_1.toHash)(dataTypes);
      if (types.array && types.object) {
        const notObj = (0, codegen_1._)`typeof ${data} != "object"`;
        cond = types.null ? notObj : (0, codegen_1._)`!${data} || ${notObj}`;
        delete types.null;
        delete types.array;
        delete types.object;
      } else {
        cond = codegen_1.nil;
      }
      if (types.number)
        delete types.integer;
      for (const t in types)
        cond = (0, codegen_1.and)(cond, checkDataType(t, data, strictNums, correct));
      return cond;
    }
    exports.checkDataTypes = checkDataTypes;
    var typeError = {
      message: ({ schema: schema2 }) => `must be ${schema2}`,
      params: ({ schema: schema2, schemaValue }) => typeof schema2 == "string" ? (0, codegen_1._)`{type: ${schema2}}` : (0, codegen_1._)`{type: ${schemaValue}}`
    };
    function reportTypeError(it) {
      const cxt = getTypeErrorContext(it);
      (0, errors_1.reportError)(cxt, typeError);
    }
    exports.reportTypeError = reportTypeError;
    function getTypeErrorContext(it) {
      const { gen, data, schema: schema2 } = it;
      const schemaCode = (0, util_1.schemaRefOrVal)(it, schema2, "type");
      return {
        gen,
        keyword: "type",
        data,
        schema: schema2.type,
        schemaCode,
        schemaValue: schemaCode,
        parentSchema: schema2,
        params: {},
        it
      };
    }
  }
});

// node_modules/ajv/dist/compile/validate/defaults.js
var require_defaults = __commonJS({
  "node_modules/ajv/dist/compile/validate/defaults.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.assignDefaults = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    function assignDefaults(it, ty) {
      const { properties, items } = it.schema;
      if (ty === "object" && properties) {
        for (const key in properties) {
          assignDefault(it, key, properties[key].default);
        }
      } else if (ty === "array" && Array.isArray(items)) {
        items.forEach((sch, i) => assignDefault(it, i, sch.default));
      }
    }
    exports.assignDefaults = assignDefaults;
    function assignDefault(it, prop, defaultValue) {
      const { gen, compositeRule, data, opts } = it;
      if (defaultValue === void 0)
        return;
      const childData = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(prop)}`;
      if (compositeRule) {
        (0, util_1.checkStrictMode)(it, `default is ignored for: ${childData}`);
        return;
      }
      let condition = (0, codegen_1._)`${childData} === undefined`;
      if (opts.useDefaults === "empty") {
        condition = (0, codegen_1._)`${condition} || ${childData} === null || ${childData} === ""`;
      }
      gen.if(condition, (0, codegen_1._)`${childData} = ${(0, codegen_1.stringify)(defaultValue)}`);
    }
  }
});

// node_modules/ajv/dist/vocabularies/code.js
var require_code2 = __commonJS({
  "node_modules/ajv/dist/vocabularies/code.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateUnion = exports.validateArray = exports.usePattern = exports.callValidateCode = exports.schemaProperties = exports.allSchemaProperties = exports.noPropertyInData = exports.propertyInData = exports.isOwnProperty = exports.hasPropFunc = exports.reportMissingProp = exports.checkMissingProp = exports.checkReportMissingProp = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var names_1 = require_names();
    var util_2 = require_util();
    function checkReportMissingProp(cxt, prop) {
      const { gen, data, it } = cxt;
      gen.if(noPropertyInData(gen, data, prop, it.opts.ownProperties), () => {
        cxt.setParams({ missingProperty: (0, codegen_1._)`${prop}` }, true);
        cxt.error();
      });
    }
    exports.checkReportMissingProp = checkReportMissingProp;
    function checkMissingProp({ gen, data, it: { opts } }, properties, missing) {
      return (0, codegen_1.or)(...properties.map((prop) => (0, codegen_1.and)(noPropertyInData(gen, data, prop, opts.ownProperties), (0, codegen_1._)`${missing} = ${prop}`)));
    }
    exports.checkMissingProp = checkMissingProp;
    function reportMissingProp(cxt, missing) {
      cxt.setParams({ missingProperty: missing }, true);
      cxt.error();
    }
    exports.reportMissingProp = reportMissingProp;
    function hasPropFunc(gen) {
      return gen.scopeValue("func", {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        ref: Object.prototype.hasOwnProperty,
        code: (0, codegen_1._)`Object.prototype.hasOwnProperty`
      });
    }
    exports.hasPropFunc = hasPropFunc;
    function isOwnProperty(gen, data, property) {
      return (0, codegen_1._)`${hasPropFunc(gen)}.call(${data}, ${property})`;
    }
    exports.isOwnProperty = isOwnProperty;
    function propertyInData(gen, data, property, ownProperties) {
      const cond = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(property)} !== undefined`;
      return ownProperties ? (0, codegen_1._)`${cond} && ${isOwnProperty(gen, data, property)}` : cond;
    }
    exports.propertyInData = propertyInData;
    function noPropertyInData(gen, data, property, ownProperties) {
      const cond = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(property)} === undefined`;
      return ownProperties ? (0, codegen_1.or)(cond, (0, codegen_1.not)(isOwnProperty(gen, data, property))) : cond;
    }
    exports.noPropertyInData = noPropertyInData;
    function allSchemaProperties(schemaMap) {
      return schemaMap ? Object.keys(schemaMap).filter((p) => p !== "__proto__") : [];
    }
    exports.allSchemaProperties = allSchemaProperties;
    function schemaProperties(it, schemaMap) {
      return allSchemaProperties(schemaMap).filter((p) => !(0, util_1.alwaysValidSchema)(it, schemaMap[p]));
    }
    exports.schemaProperties = schemaProperties;
    function callValidateCode({ schemaCode, data, it: { gen, topSchemaRef, schemaPath, errorPath }, it }, func, context, passSchema) {
      const dataAndSchema = passSchema ? (0, codegen_1._)`${schemaCode}, ${data}, ${topSchemaRef}${schemaPath}` : data;
      const valCxt = [
        [names_1.default.instancePath, (0, codegen_1.strConcat)(names_1.default.instancePath, errorPath)],
        [names_1.default.parentData, it.parentData],
        [names_1.default.parentDataProperty, it.parentDataProperty],
        [names_1.default.rootData, names_1.default.rootData]
      ];
      if (it.opts.dynamicRef)
        valCxt.push([names_1.default.dynamicAnchors, names_1.default.dynamicAnchors]);
      const args = (0, codegen_1._)`${dataAndSchema}, ${gen.object(...valCxt)}`;
      return context !== codegen_1.nil ? (0, codegen_1._)`${func}.call(${context}, ${args})` : (0, codegen_1._)`${func}(${args})`;
    }
    exports.callValidateCode = callValidateCode;
    var newRegExp = (0, codegen_1._)`new RegExp`;
    function usePattern({ gen, it: { opts } }, pattern) {
      const u = opts.unicodeRegExp ? "u" : "";
      const { regExp } = opts.code;
      const rx = regExp(pattern, u);
      return gen.scopeValue("pattern", {
        key: rx.toString(),
        ref: rx,
        code: (0, codegen_1._)`${regExp.code === "new RegExp" ? newRegExp : (0, util_2.useFunc)(gen, regExp)}(${pattern}, ${u})`
      });
    }
    exports.usePattern = usePattern;
    function validateArray(cxt) {
      const { gen, data, keyword, it } = cxt;
      const valid = gen.name("valid");
      if (it.allErrors) {
        const validArr = gen.let("valid", true);
        validateItems(() => gen.assign(validArr, false));
        return validArr;
      }
      gen.var(valid, true);
      validateItems(() => gen.break());
      return valid;
      function validateItems(notValid) {
        const len = gen.const("len", (0, codegen_1._)`${data}.length`);
        gen.forRange("i", 0, len, (i) => {
          cxt.subschema({
            keyword,
            dataProp: i,
            dataPropType: util_1.Type.Num
          }, valid);
          gen.if((0, codegen_1.not)(valid), notValid);
        });
      }
    }
    exports.validateArray = validateArray;
    function validateUnion(cxt) {
      const { gen, schema: schema2, keyword, it } = cxt;
      if (!Array.isArray(schema2))
        throw new Error("ajv implementation error");
      const alwaysValid = schema2.some((sch) => (0, util_1.alwaysValidSchema)(it, sch));
      if (alwaysValid && !it.opts.unevaluated)
        return;
      const valid = gen.let("valid", false);
      const schValid = gen.name("_valid");
      gen.block(() => schema2.forEach((_sch, i) => {
        const schCxt = cxt.subschema({
          keyword,
          schemaProp: i,
          compositeRule: true
        }, schValid);
        gen.assign(valid, (0, codegen_1._)`${valid} || ${schValid}`);
        const merged = cxt.mergeValidEvaluated(schCxt, schValid);
        if (!merged)
          gen.if((0, codegen_1.not)(valid));
      }));
      cxt.result(valid, () => cxt.reset(), () => cxt.error(true));
    }
    exports.validateUnion = validateUnion;
  }
});

// node_modules/ajv/dist/compile/validate/keyword.js
var require_keyword = __commonJS({
  "node_modules/ajv/dist/compile/validate/keyword.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateKeywordUsage = exports.validSchemaType = exports.funcKeywordCode = exports.macroKeywordCode = void 0;
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var code_1 = require_code2();
    var errors_1 = require_errors2();
    function macroKeywordCode(cxt, def) {
      const { gen, keyword, schema: schema2, parentSchema, it } = cxt;
      const macroSchema = def.macro.call(it.self, schema2, parentSchema, it);
      const schemaRef = useKeyword(gen, keyword, macroSchema);
      if (it.opts.validateSchema !== false)
        it.self.validateSchema(macroSchema, true);
      const valid = gen.name("valid");
      cxt.subschema({
        schema: macroSchema,
        schemaPath: codegen_1.nil,
        errSchemaPath: `${it.errSchemaPath}/${keyword}`,
        topSchemaRef: schemaRef,
        compositeRule: true
      }, valid);
      cxt.pass(valid, () => cxt.error(true));
    }
    exports.macroKeywordCode = macroKeywordCode;
    function funcKeywordCode(cxt, def) {
      var _a;
      const { gen, keyword, schema: schema2, parentSchema, $data, it } = cxt;
      checkAsyncKeyword(it, def);
      const validate2 = !$data && def.compile ? def.compile.call(it.self, schema2, parentSchema, it) : def.validate;
      const validateRef = useKeyword(gen, keyword, validate2);
      const valid = gen.let("valid");
      cxt.block$data(valid, validateKeyword);
      cxt.ok((_a = def.valid) !== null && _a !== void 0 ? _a : valid);
      function validateKeyword() {
        if (def.errors === false) {
          assignValid();
          if (def.modifying)
            modifyData(cxt);
          reportErrs(() => cxt.error());
        } else {
          const ruleErrs = def.async ? validateAsync() : validateSync();
          if (def.modifying)
            modifyData(cxt);
          reportErrs(() => addErrs(cxt, ruleErrs));
        }
      }
      function validateAsync() {
        const ruleErrs = gen.let("ruleErrs", null);
        gen.try(() => assignValid((0, codegen_1._)`await `), (e) => gen.assign(valid, false).if((0, codegen_1._)`${e} instanceof ${it.ValidationError}`, () => gen.assign(ruleErrs, (0, codegen_1._)`${e}.errors`), () => gen.throw(e)));
        return ruleErrs;
      }
      function validateSync() {
        const validateErrs = (0, codegen_1._)`${validateRef}.errors`;
        gen.assign(validateErrs, null);
        assignValid(codegen_1.nil);
        return validateErrs;
      }
      function assignValid(_await = def.async ? (0, codegen_1._)`await ` : codegen_1.nil) {
        const passCxt = it.opts.passContext ? names_1.default.this : names_1.default.self;
        const passSchema = !("compile" in def && !$data || def.schema === false);
        gen.assign(valid, (0, codegen_1._)`${_await}${(0, code_1.callValidateCode)(cxt, validateRef, passCxt, passSchema)}`, def.modifying);
      }
      function reportErrs(errors) {
        var _a2;
        gen.if((0, codegen_1.not)((_a2 = def.valid) !== null && _a2 !== void 0 ? _a2 : valid), errors);
      }
    }
    exports.funcKeywordCode = funcKeywordCode;
    function modifyData(cxt) {
      const { gen, data, it } = cxt;
      gen.if(it.parentData, () => gen.assign(data, (0, codegen_1._)`${it.parentData}[${it.parentDataProperty}]`));
    }
    function addErrs(cxt, errs) {
      const { gen } = cxt;
      gen.if((0, codegen_1._)`Array.isArray(${errs})`, () => {
        gen.assign(names_1.default.vErrors, (0, codegen_1._)`${names_1.default.vErrors} === null ? ${errs} : ${names_1.default.vErrors}.concat(${errs})`).assign(names_1.default.errors, (0, codegen_1._)`${names_1.default.vErrors}.length`);
        (0, errors_1.extendErrors)(cxt);
      }, () => cxt.error());
    }
    function checkAsyncKeyword({ schemaEnv }, def) {
      if (def.async && !schemaEnv.$async)
        throw new Error("async keyword in sync schema");
    }
    function useKeyword(gen, keyword, result) {
      if (result === void 0)
        throw new Error(`keyword "${keyword}" failed to compile`);
      return gen.scopeValue("keyword", typeof result == "function" ? { ref: result } : { ref: result, code: (0, codegen_1.stringify)(result) });
    }
    function validSchemaType(schema2, schemaType, allowUndefined = false) {
      return !schemaType.length || schemaType.some((st) => st === "array" ? Array.isArray(schema2) : st === "object" ? schema2 && typeof schema2 == "object" && !Array.isArray(schema2) : typeof schema2 == st || allowUndefined && typeof schema2 == "undefined");
    }
    exports.validSchemaType = validSchemaType;
    function validateKeywordUsage({ schema: schema2, opts, self, errSchemaPath }, def, keyword) {
      if (Array.isArray(def.keyword) ? !def.keyword.includes(keyword) : def.keyword !== keyword) {
        throw new Error("ajv implementation error");
      }
      const deps = def.dependencies;
      if (deps === null || deps === void 0 ? void 0 : deps.some((kwd) => !Object.prototype.hasOwnProperty.call(schema2, kwd))) {
        throw new Error(`parent schema must have dependencies of ${keyword}: ${deps.join(",")}`);
      }
      if (def.validateSchema) {
        const valid = def.validateSchema(schema2[keyword]);
        if (!valid) {
          const msg = `keyword "${keyword}" value is invalid at path "${errSchemaPath}": ` + self.errorsText(def.validateSchema.errors);
          if (opts.validateSchema === "log")
            self.logger.error(msg);
          else
            throw new Error(msg);
        }
      }
    }
    exports.validateKeywordUsage = validateKeywordUsage;
  }
});

// node_modules/ajv/dist/compile/validate/subschema.js
var require_subschema = __commonJS({
  "node_modules/ajv/dist/compile/validate/subschema.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.extendSubschemaMode = exports.extendSubschemaData = exports.getSubschema = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    function getSubschema(it, { keyword, schemaProp, schema: schema2, schemaPath, errSchemaPath, topSchemaRef }) {
      if (keyword !== void 0 && schema2 !== void 0) {
        throw new Error('both "keyword" and "schema" passed, only one allowed');
      }
      if (keyword !== void 0) {
        const sch = it.schema[keyword];
        return schemaProp === void 0 ? {
          schema: sch,
          schemaPath: (0, codegen_1._)`${it.schemaPath}${(0, codegen_1.getProperty)(keyword)}`,
          errSchemaPath: `${it.errSchemaPath}/${keyword}`
        } : {
          schema: sch[schemaProp],
          schemaPath: (0, codegen_1._)`${it.schemaPath}${(0, codegen_1.getProperty)(keyword)}${(0, codegen_1.getProperty)(schemaProp)}`,
          errSchemaPath: `${it.errSchemaPath}/${keyword}/${(0, util_1.escapeFragment)(schemaProp)}`
        };
      }
      if (schema2 !== void 0) {
        if (schemaPath === void 0 || errSchemaPath === void 0 || topSchemaRef === void 0) {
          throw new Error('"schemaPath", "errSchemaPath" and "topSchemaRef" are required with "schema"');
        }
        return {
          schema: schema2,
          schemaPath,
          topSchemaRef,
          errSchemaPath
        };
      }
      throw new Error('either "keyword" or "schema" must be passed');
    }
    exports.getSubschema = getSubschema;
    function extendSubschemaData(subschema, it, { dataProp, dataPropType: dpType, data, dataTypes, propertyName }) {
      if (data !== void 0 && dataProp !== void 0) {
        throw new Error('both "data" and "dataProp" passed, only one allowed');
      }
      const { gen } = it;
      if (dataProp !== void 0) {
        const { errorPath, dataPathArr, opts } = it;
        const nextData = gen.let("data", (0, codegen_1._)`${it.data}${(0, codegen_1.getProperty)(dataProp)}`, true);
        dataContextProps(nextData);
        subschema.errorPath = (0, codegen_1.str)`${errorPath}${(0, util_1.getErrorPath)(dataProp, dpType, opts.jsPropertySyntax)}`;
        subschema.parentDataProperty = (0, codegen_1._)`${dataProp}`;
        subschema.dataPathArr = [...dataPathArr, subschema.parentDataProperty];
      }
      if (data !== void 0) {
        const nextData = data instanceof codegen_1.Name ? data : gen.let("data", data, true);
        dataContextProps(nextData);
        if (propertyName !== void 0)
          subschema.propertyName = propertyName;
      }
      if (dataTypes)
        subschema.dataTypes = dataTypes;
      function dataContextProps(_nextData) {
        subschema.data = _nextData;
        subschema.dataLevel = it.dataLevel + 1;
        subschema.dataTypes = [];
        it.definedProperties = /* @__PURE__ */ new Set();
        subschema.parentData = it.data;
        subschema.dataNames = [...it.dataNames, _nextData];
      }
    }
    exports.extendSubschemaData = extendSubschemaData;
    function extendSubschemaMode(subschema, { jtdDiscriminator, jtdMetadata, compositeRule, createErrors, allErrors }) {
      if (compositeRule !== void 0)
        subschema.compositeRule = compositeRule;
      if (createErrors !== void 0)
        subschema.createErrors = createErrors;
      if (allErrors !== void 0)
        subschema.allErrors = allErrors;
      subschema.jtdDiscriminator = jtdDiscriminator;
      subschema.jtdMetadata = jtdMetadata;
    }
    exports.extendSubschemaMode = extendSubschemaMode;
  }
});

// node_modules/fast-deep-equal/index.js
var require_fast_deep_equal = __commonJS({
  "node_modules/fast-deep-equal/index.js"(exports, module) {
    "use strict";
    module.exports = function equal(a, b) {
      if (a === b) return true;
      if (a && b && typeof a == "object" && typeof b == "object") {
        if (a.constructor !== b.constructor) return false;
        var length, i, keys;
        if (Array.isArray(a)) {
          length = a.length;
          if (length != b.length) return false;
          for (i = length; i-- !== 0; )
            if (!equal(a[i], b[i])) return false;
          return true;
        }
        if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
        if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
        if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();
        keys = Object.keys(a);
        length = keys.length;
        if (length !== Object.keys(b).length) return false;
        for (i = length; i-- !== 0; )
          if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;
        for (i = length; i-- !== 0; ) {
          var key = keys[i];
          if (!equal(a[key], b[key])) return false;
        }
        return true;
      }
      return a !== a && b !== b;
    };
  }
});

// node_modules/json-schema-traverse/index.js
var require_json_schema_traverse = __commonJS({
  "node_modules/json-schema-traverse/index.js"(exports, module) {
    "use strict";
    var traverse = module.exports = function(schema2, opts, cb) {
      if (typeof opts == "function") {
        cb = opts;
        opts = {};
      }
      cb = opts.cb || cb;
      var pre = typeof cb == "function" ? cb : cb.pre || function() {
      };
      var post = cb.post || function() {
      };
      _traverse(opts, pre, post, schema2, "", schema2);
    };
    traverse.keywords = {
      additionalItems: true,
      items: true,
      contains: true,
      additionalProperties: true,
      propertyNames: true,
      not: true,
      if: true,
      then: true,
      else: true
    };
    traverse.arrayKeywords = {
      items: true,
      allOf: true,
      anyOf: true,
      oneOf: true
    };
    traverse.propsKeywords = {
      $defs: true,
      definitions: true,
      properties: true,
      patternProperties: true,
      dependencies: true
    };
    traverse.skipKeywords = {
      default: true,
      enum: true,
      const: true,
      required: true,
      maximum: true,
      minimum: true,
      exclusiveMaximum: true,
      exclusiveMinimum: true,
      multipleOf: true,
      maxLength: true,
      minLength: true,
      pattern: true,
      format: true,
      maxItems: true,
      minItems: true,
      uniqueItems: true,
      maxProperties: true,
      minProperties: true
    };
    function _traverse(opts, pre, post, schema2, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex) {
      if (schema2 && typeof schema2 == "object" && !Array.isArray(schema2)) {
        pre(schema2, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex);
        for (var key in schema2) {
          var sch = schema2[key];
          if (Array.isArray(sch)) {
            if (key in traverse.arrayKeywords) {
              for (var i = 0; i < sch.length; i++)
                _traverse(opts, pre, post, sch[i], jsonPtr + "/" + key + "/" + i, rootSchema, jsonPtr, key, schema2, i);
            }
          } else if (key in traverse.propsKeywords) {
            if (sch && typeof sch == "object") {
              for (var prop in sch)
                _traverse(opts, pre, post, sch[prop], jsonPtr + "/" + key + "/" + escapeJsonPtr(prop), rootSchema, jsonPtr, key, schema2, prop);
            }
          } else if (key in traverse.keywords || opts.allKeys && !(key in traverse.skipKeywords)) {
            _traverse(opts, pre, post, sch, jsonPtr + "/" + key, rootSchema, jsonPtr, key, schema2);
          }
        }
        post(schema2, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex);
      }
    }
    function escapeJsonPtr(str) {
      return str.replace(/~/g, "~0").replace(/\//g, "~1");
    }
  }
});

// node_modules/ajv/dist/compile/resolve.js
var require_resolve = __commonJS({
  "node_modules/ajv/dist/compile/resolve.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getSchemaRefs = exports.resolveUrl = exports.normalizeId = exports._getFullPath = exports.getFullPath = exports.inlineRef = void 0;
    var util_1 = require_util();
    var equal = require_fast_deep_equal();
    var traverse = require_json_schema_traverse();
    var SIMPLE_INLINED = /* @__PURE__ */ new Set([
      "type",
      "format",
      "pattern",
      "maxLength",
      "minLength",
      "maxProperties",
      "minProperties",
      "maxItems",
      "minItems",
      "maximum",
      "minimum",
      "uniqueItems",
      "multipleOf",
      "required",
      "enum",
      "const"
    ]);
    function inlineRef(schema2, limit = true) {
      if (typeof schema2 == "boolean")
        return true;
      if (limit === true)
        return !hasRef(schema2);
      if (!limit)
        return false;
      return countKeys(schema2) <= limit;
    }
    exports.inlineRef = inlineRef;
    var REF_KEYWORDS = /* @__PURE__ */ new Set([
      "$ref",
      "$recursiveRef",
      "$recursiveAnchor",
      "$dynamicRef",
      "$dynamicAnchor"
    ]);
    function hasRef(schema2) {
      for (const key in schema2) {
        if (REF_KEYWORDS.has(key))
          return true;
        const sch = schema2[key];
        if (Array.isArray(sch) && sch.some(hasRef))
          return true;
        if (typeof sch == "object" && hasRef(sch))
          return true;
      }
      return false;
    }
    function countKeys(schema2) {
      let count = 0;
      for (const key in schema2) {
        if (key === "$ref")
          return Infinity;
        count++;
        if (SIMPLE_INLINED.has(key))
          continue;
        if (typeof schema2[key] == "object") {
          (0, util_1.eachItem)(schema2[key], (sch) => count += countKeys(sch));
        }
        if (count === Infinity)
          return Infinity;
      }
      return count;
    }
    function getFullPath(resolver, id = "", normalize) {
      if (normalize !== false)
        id = normalizeId(id);
      const p = resolver.parse(id);
      return _getFullPath(resolver, p);
    }
    exports.getFullPath = getFullPath;
    function _getFullPath(resolver, p) {
      const serialized = resolver.serialize(p);
      return serialized.split("#")[0] + "#";
    }
    exports._getFullPath = _getFullPath;
    var TRAILING_SLASH_HASH = /#\/?$/;
    function normalizeId(id) {
      return id ? id.replace(TRAILING_SLASH_HASH, "") : "";
    }
    exports.normalizeId = normalizeId;
    function resolveUrl(resolver, baseId, id) {
      id = normalizeId(id);
      return resolver.resolve(baseId, id);
    }
    exports.resolveUrl = resolveUrl;
    var ANCHOR = /^[a-z_][-a-z0-9._]*$/i;
    function getSchemaRefs(schema2, baseId) {
      if (typeof schema2 == "boolean")
        return {};
      const { schemaId, uriResolver } = this.opts;
      const schId = normalizeId(schema2[schemaId] || baseId);
      const baseIds = { "": schId };
      const pathPrefix = getFullPath(uriResolver, schId, false);
      const localRefs = {};
      const schemaRefs = /* @__PURE__ */ new Set();
      traverse(schema2, { allKeys: true }, (sch, jsonPtr, _, parentJsonPtr) => {
        if (parentJsonPtr === void 0)
          return;
        const fullPath = pathPrefix + jsonPtr;
        let innerBaseId = baseIds[parentJsonPtr];
        if (typeof sch[schemaId] == "string")
          innerBaseId = addRef.call(this, sch[schemaId]);
        addAnchor.call(this, sch.$anchor);
        addAnchor.call(this, sch.$dynamicAnchor);
        baseIds[jsonPtr] = innerBaseId;
        function addRef(ref) {
          const _resolve = this.opts.uriResolver.resolve;
          ref = normalizeId(innerBaseId ? _resolve(innerBaseId, ref) : ref);
          if (schemaRefs.has(ref))
            throw ambiguos(ref);
          schemaRefs.add(ref);
          let schOrRef = this.refs[ref];
          if (typeof schOrRef == "string")
            schOrRef = this.refs[schOrRef];
          if (typeof schOrRef == "object") {
            checkAmbiguosRef(sch, schOrRef.schema, ref);
          } else if (ref !== normalizeId(fullPath)) {
            if (ref[0] === "#") {
              checkAmbiguosRef(sch, localRefs[ref], ref);
              localRefs[ref] = sch;
            } else {
              this.refs[ref] = fullPath;
            }
          }
          return ref;
        }
        function addAnchor(anchor) {
          if (typeof anchor == "string") {
            if (!ANCHOR.test(anchor))
              throw new Error(`invalid anchor "${anchor}"`);
            addRef.call(this, `#${anchor}`);
          }
        }
      });
      return localRefs;
      function checkAmbiguosRef(sch1, sch2, ref) {
        if (sch2 !== void 0 && !equal(sch1, sch2))
          throw ambiguos(ref);
      }
      function ambiguos(ref) {
        return new Error(`reference "${ref}" resolves to more than one schema`);
      }
    }
    exports.getSchemaRefs = getSchemaRefs;
  }
});

// node_modules/ajv/dist/compile/validate/index.js
var require_validate = __commonJS({
  "node_modules/ajv/dist/compile/validate/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getData = exports.KeywordCxt = exports.validateFunctionCode = void 0;
    var boolSchema_1 = require_boolSchema();
    var dataType_1 = require_dataType();
    var applicability_1 = require_applicability();
    var dataType_2 = require_dataType();
    var defaults_1 = require_defaults();
    var keyword_1 = require_keyword();
    var subschema_1 = require_subschema();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var resolve_1 = require_resolve();
    var util_1 = require_util();
    var errors_1 = require_errors2();
    function validateFunctionCode(it) {
      if (isSchemaObj(it)) {
        checkKeywords(it);
        if (schemaCxtHasRules(it)) {
          topSchemaObjCode(it);
          return;
        }
      }
      validateFunction2(it, () => (0, boolSchema_1.topBoolOrEmptySchema)(it));
    }
    exports.validateFunctionCode = validateFunctionCode;
    function validateFunction2({ gen, validateName, schema: schema2, schemaEnv, opts }, body) {
      if (opts.code.es5) {
        gen.func(validateName, (0, codegen_1._)`${names_1.default.data}, ${names_1.default.valCxt}`, schemaEnv.$async, () => {
          gen.code((0, codegen_1._)`"use strict"; ${funcSourceUrl(schema2, opts)}`);
          destructureValCxtES5(gen, opts);
          gen.code(body);
        });
      } else {
        gen.func(validateName, (0, codegen_1._)`${names_1.default.data}, ${destructureValCxt(opts)}`, schemaEnv.$async, () => gen.code(funcSourceUrl(schema2, opts)).code(body));
      }
    }
    function destructureValCxt(opts) {
      return (0, codegen_1._)`{${names_1.default.instancePath}="", ${names_1.default.parentData}, ${names_1.default.parentDataProperty}, ${names_1.default.rootData}=${names_1.default.data}${opts.dynamicRef ? (0, codegen_1._)`, ${names_1.default.dynamicAnchors}={}` : codegen_1.nil}}={}`;
    }
    function destructureValCxtES5(gen, opts) {
      gen.if(names_1.default.valCxt, () => {
        gen.var(names_1.default.instancePath, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.instancePath}`);
        gen.var(names_1.default.parentData, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.parentData}`);
        gen.var(names_1.default.parentDataProperty, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.parentDataProperty}`);
        gen.var(names_1.default.rootData, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.rootData}`);
        if (opts.dynamicRef)
          gen.var(names_1.default.dynamicAnchors, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.dynamicAnchors}`);
      }, () => {
        gen.var(names_1.default.instancePath, (0, codegen_1._)`""`);
        gen.var(names_1.default.parentData, (0, codegen_1._)`undefined`);
        gen.var(names_1.default.parentDataProperty, (0, codegen_1._)`undefined`);
        gen.var(names_1.default.rootData, names_1.default.data);
        if (opts.dynamicRef)
          gen.var(names_1.default.dynamicAnchors, (0, codegen_1._)`{}`);
      });
    }
    function topSchemaObjCode(it) {
      const { schema: schema2, opts, gen } = it;
      validateFunction2(it, () => {
        if (opts.$comment && schema2.$comment)
          commentKeyword(it);
        checkNoDefault(it);
        gen.let(names_1.default.vErrors, null);
        gen.let(names_1.default.errors, 0);
        if (opts.unevaluated)
          resetEvaluated(it);
        typeAndKeywords(it);
        returnResults(it);
      });
      return;
    }
    function resetEvaluated(it) {
      const { gen, validateName } = it;
      it.evaluated = gen.const("evaluated", (0, codegen_1._)`${validateName}.evaluated`);
      gen.if((0, codegen_1._)`${it.evaluated}.dynamicProps`, () => gen.assign((0, codegen_1._)`${it.evaluated}.props`, (0, codegen_1._)`undefined`));
      gen.if((0, codegen_1._)`${it.evaluated}.dynamicItems`, () => gen.assign((0, codegen_1._)`${it.evaluated}.items`, (0, codegen_1._)`undefined`));
    }
    function funcSourceUrl(schema2, opts) {
      const schId = typeof schema2 == "object" && schema2[opts.schemaId];
      return schId && (opts.code.source || opts.code.process) ? (0, codegen_1._)`/*# sourceURL=${schId} */` : codegen_1.nil;
    }
    function subschemaCode(it, valid) {
      if (isSchemaObj(it)) {
        checkKeywords(it);
        if (schemaCxtHasRules(it)) {
          subSchemaObjCode(it, valid);
          return;
        }
      }
      (0, boolSchema_1.boolOrEmptySchema)(it, valid);
    }
    function schemaCxtHasRules({ schema: schema2, self }) {
      if (typeof schema2 == "boolean")
        return !schema2;
      for (const key in schema2)
        if (self.RULES.all[key])
          return true;
      return false;
    }
    function isSchemaObj(it) {
      return typeof it.schema != "boolean";
    }
    function subSchemaObjCode(it, valid) {
      const { schema: schema2, gen, opts } = it;
      if (opts.$comment && schema2.$comment)
        commentKeyword(it);
      updateContext(it);
      checkAsyncSchema(it);
      const errsCount = gen.const("_errs", names_1.default.errors);
      typeAndKeywords(it, errsCount);
      gen.var(valid, (0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
    }
    function checkKeywords(it) {
      (0, util_1.checkUnknownRules)(it);
      checkRefsAndKeywords(it);
    }
    function typeAndKeywords(it, errsCount) {
      if (it.opts.jtd)
        return schemaKeywords(it, [], false, errsCount);
      const types = (0, dataType_1.getSchemaTypes)(it.schema);
      const checkedTypes = (0, dataType_1.coerceAndCheckDataType)(it, types);
      schemaKeywords(it, types, !checkedTypes, errsCount);
    }
    function checkRefsAndKeywords(it) {
      const { schema: schema2, errSchemaPath, opts, self } = it;
      if (schema2.$ref && opts.ignoreKeywordsWithRef && (0, util_1.schemaHasRulesButRef)(schema2, self.RULES)) {
        self.logger.warn(`$ref: keywords ignored in schema at path "${errSchemaPath}"`);
      }
    }
    function checkNoDefault(it) {
      const { schema: schema2, opts } = it;
      if (schema2.default !== void 0 && opts.useDefaults && opts.strictSchema) {
        (0, util_1.checkStrictMode)(it, "default is ignored in the schema root");
      }
    }
    function updateContext(it) {
      const schId = it.schema[it.opts.schemaId];
      if (schId)
        it.baseId = (0, resolve_1.resolveUrl)(it.opts.uriResolver, it.baseId, schId);
    }
    function checkAsyncSchema(it) {
      if (it.schema.$async && !it.schemaEnv.$async)
        throw new Error("async schema in sync schema");
    }
    function commentKeyword({ gen, schemaEnv, schema: schema2, errSchemaPath, opts }) {
      const msg = schema2.$comment;
      if (opts.$comment === true) {
        gen.code((0, codegen_1._)`${names_1.default.self}.logger.log(${msg})`);
      } else if (typeof opts.$comment == "function") {
        const schemaPath = (0, codegen_1.str)`${errSchemaPath}/$comment`;
        const rootName = gen.scopeValue("root", { ref: schemaEnv.root });
        gen.code((0, codegen_1._)`${names_1.default.self}.opts.$comment(${msg}, ${schemaPath}, ${rootName}.schema)`);
      }
    }
    function returnResults(it) {
      const { gen, schemaEnv, validateName, ValidationError, opts } = it;
      if (schemaEnv.$async) {
        gen.if((0, codegen_1._)`${names_1.default.errors} === 0`, () => gen.return(names_1.default.data), () => gen.throw((0, codegen_1._)`new ${ValidationError}(${names_1.default.vErrors})`));
      } else {
        gen.assign((0, codegen_1._)`${validateName}.errors`, names_1.default.vErrors);
        if (opts.unevaluated)
          assignEvaluated(it);
        gen.return((0, codegen_1._)`${names_1.default.errors} === 0`);
      }
    }
    function assignEvaluated({ gen, evaluated, props, items }) {
      if (props instanceof codegen_1.Name)
        gen.assign((0, codegen_1._)`${evaluated}.props`, props);
      if (items instanceof codegen_1.Name)
        gen.assign((0, codegen_1._)`${evaluated}.items`, items);
    }
    function schemaKeywords(it, types, typeErrors, errsCount) {
      const { gen, schema: schema2, data, allErrors, opts, self } = it;
      const { RULES: RULES2 } = self;
      if (schema2.$ref && (opts.ignoreKeywordsWithRef || !(0, util_1.schemaHasRulesButRef)(schema2, RULES2))) {
        gen.block(() => keywordCode(it, "$ref", RULES2.all.$ref.definition));
        return;
      }
      if (!opts.jtd)
        checkStrictTypes(it, types);
      gen.block(() => {
        for (const group of RULES2.rules)
          groupKeywords(group);
        groupKeywords(RULES2.post);
      });
      function groupKeywords(group) {
        if (!(0, applicability_1.shouldUseGroup)(schema2, group))
          return;
        if (group.type) {
          gen.if((0, dataType_2.checkDataType)(group.type, data, opts.strictNumbers));
          iterateKeywords(it, group);
          if (types.length === 1 && types[0] === group.type && typeErrors) {
            gen.else();
            (0, dataType_2.reportTypeError)(it);
          }
          gen.endIf();
        } else {
          iterateKeywords(it, group);
        }
        if (!allErrors)
          gen.if((0, codegen_1._)`${names_1.default.errors} === ${errsCount || 0}`);
      }
    }
    function iterateKeywords(it, group) {
      const { gen, schema: schema2, opts: { useDefaults } } = it;
      if (useDefaults)
        (0, defaults_1.assignDefaults)(it, group.type);
      gen.block(() => {
        for (const rule of group.rules) {
          if ((0, applicability_1.shouldUseRule)(schema2, rule)) {
            keywordCode(it, rule.keyword, rule.definition, group.type);
          }
        }
      });
    }
    function checkStrictTypes(it, types) {
      if (it.schemaEnv.meta || !it.opts.strictTypes)
        return;
      checkContextTypes(it, types);
      if (!it.opts.allowUnionTypes)
        checkMultipleTypes(it, types);
      checkKeywordTypes(it, it.dataTypes);
    }
    function checkContextTypes(it, types) {
      if (!types.length)
        return;
      if (!it.dataTypes.length) {
        it.dataTypes = types;
        return;
      }
      types.forEach((t) => {
        if (!includesType(it.dataTypes, t)) {
          strictTypesError(it, `type "${t}" not allowed by context "${it.dataTypes.join(",")}"`);
        }
      });
      narrowSchemaTypes(it, types);
    }
    function checkMultipleTypes(it, ts) {
      if (ts.length > 1 && !(ts.length === 2 && ts.includes("null"))) {
        strictTypesError(it, "use allowUnionTypes to allow union type keyword");
      }
    }
    function checkKeywordTypes(it, ts) {
      const rules = it.self.RULES.all;
      for (const keyword in rules) {
        const rule = rules[keyword];
        if (typeof rule == "object" && (0, applicability_1.shouldUseRule)(it.schema, rule)) {
          const { type } = rule.definition;
          if (type.length && !type.some((t) => hasApplicableType(ts, t))) {
            strictTypesError(it, `missing type "${type.join(",")}" for keyword "${keyword}"`);
          }
        }
      }
    }
    function hasApplicableType(schTs, kwdT) {
      return schTs.includes(kwdT) || kwdT === "number" && schTs.includes("integer");
    }
    function includesType(ts, t) {
      return ts.includes(t) || t === "integer" && ts.includes("number");
    }
    function narrowSchemaTypes(it, withTypes) {
      const ts = [];
      for (const t of it.dataTypes) {
        if (includesType(withTypes, t))
          ts.push(t);
        else if (withTypes.includes("integer") && t === "number")
          ts.push("integer");
      }
      it.dataTypes = ts;
    }
    function strictTypesError(it, msg) {
      const schemaPath = it.schemaEnv.baseId + it.errSchemaPath;
      msg += ` at "${schemaPath}" (strictTypes)`;
      (0, util_1.checkStrictMode)(it, msg, it.opts.strictTypes);
    }
    var KeywordCxt = class {
      constructor(it, def, keyword) {
        (0, keyword_1.validateKeywordUsage)(it, def, keyword);
        this.gen = it.gen;
        this.allErrors = it.allErrors;
        this.keyword = keyword;
        this.data = it.data;
        this.schema = it.schema[keyword];
        this.$data = def.$data && it.opts.$data && this.schema && this.schema.$data;
        this.schemaValue = (0, util_1.schemaRefOrVal)(it, this.schema, keyword, this.$data);
        this.schemaType = def.schemaType;
        this.parentSchema = it.schema;
        this.params = {};
        this.it = it;
        this.def = def;
        if (this.$data) {
          this.schemaCode = it.gen.const("vSchema", getData(this.$data, it));
        } else {
          this.schemaCode = this.schemaValue;
          if (!(0, keyword_1.validSchemaType)(this.schema, def.schemaType, def.allowUndefined)) {
            throw new Error(`${keyword} value must be ${JSON.stringify(def.schemaType)}`);
          }
        }
        if ("code" in def ? def.trackErrors : def.errors !== false) {
          this.errsCount = it.gen.const("_errs", names_1.default.errors);
        }
      }
      result(condition, successAction, failAction) {
        this.failResult((0, codegen_1.not)(condition), successAction, failAction);
      }
      failResult(condition, successAction, failAction) {
        this.gen.if(condition);
        if (failAction)
          failAction();
        else
          this.error();
        if (successAction) {
          this.gen.else();
          successAction();
          if (this.allErrors)
            this.gen.endIf();
        } else {
          if (this.allErrors)
            this.gen.endIf();
          else
            this.gen.else();
        }
      }
      pass(condition, failAction) {
        this.failResult((0, codegen_1.not)(condition), void 0, failAction);
      }
      fail(condition) {
        if (condition === void 0) {
          this.error();
          if (!this.allErrors)
            this.gen.if(false);
          return;
        }
        this.gen.if(condition);
        this.error();
        if (this.allErrors)
          this.gen.endIf();
        else
          this.gen.else();
      }
      fail$data(condition) {
        if (!this.$data)
          return this.fail(condition);
        const { schemaCode } = this;
        this.fail((0, codegen_1._)`${schemaCode} !== undefined && (${(0, codegen_1.or)(this.invalid$data(), condition)})`);
      }
      error(append, errorParams, errorPaths) {
        if (errorParams) {
          this.setParams(errorParams);
          this._error(append, errorPaths);
          this.setParams({});
          return;
        }
        this._error(append, errorPaths);
      }
      _error(append, errorPaths) {
        ;
        (append ? errors_1.reportExtraError : errors_1.reportError)(this, this.def.error, errorPaths);
      }
      $dataError() {
        (0, errors_1.reportError)(this, this.def.$dataError || errors_1.keyword$DataError);
      }
      reset() {
        if (this.errsCount === void 0)
          throw new Error('add "trackErrors" to keyword definition');
        (0, errors_1.resetErrorsCount)(this.gen, this.errsCount);
      }
      ok(cond) {
        if (!this.allErrors)
          this.gen.if(cond);
      }
      setParams(obj, assign) {
        if (assign)
          Object.assign(this.params, obj);
        else
          this.params = obj;
      }
      block$data(valid, codeBlock, $dataValid = codegen_1.nil) {
        this.gen.block(() => {
          this.check$data(valid, $dataValid);
          codeBlock();
        });
      }
      check$data(valid = codegen_1.nil, $dataValid = codegen_1.nil) {
        if (!this.$data)
          return;
        const { gen, schemaCode, schemaType, def } = this;
        gen.if((0, codegen_1.or)((0, codegen_1._)`${schemaCode} === undefined`, $dataValid));
        if (valid !== codegen_1.nil)
          gen.assign(valid, true);
        if (schemaType.length || def.validateSchema) {
          gen.elseIf(this.invalid$data());
          this.$dataError();
          if (valid !== codegen_1.nil)
            gen.assign(valid, false);
        }
        gen.else();
      }
      invalid$data() {
        const { gen, schemaCode, schemaType, def, it } = this;
        return (0, codegen_1.or)(wrong$DataType(), invalid$DataSchema());
        function wrong$DataType() {
          if (schemaType.length) {
            if (!(schemaCode instanceof codegen_1.Name))
              throw new Error("ajv implementation error");
            const st = Array.isArray(schemaType) ? schemaType : [schemaType];
            return (0, codegen_1._)`${(0, dataType_2.checkDataTypes)(st, schemaCode, it.opts.strictNumbers, dataType_2.DataType.Wrong)}`;
          }
          return codegen_1.nil;
        }
        function invalid$DataSchema() {
          if (def.validateSchema) {
            const validateSchemaRef = gen.scopeValue("validate$data", { ref: def.validateSchema });
            return (0, codegen_1._)`!${validateSchemaRef}(${schemaCode})`;
          }
          return codegen_1.nil;
        }
      }
      subschema(appl, valid) {
        const subschema = (0, subschema_1.getSubschema)(this.it, appl);
        (0, subschema_1.extendSubschemaData)(subschema, this.it, appl);
        (0, subschema_1.extendSubschemaMode)(subschema, appl);
        const nextContext = { ...this.it, ...subschema, items: void 0, props: void 0 };
        subschemaCode(nextContext, valid);
        return nextContext;
      }
      mergeEvaluated(schemaCxt, toName) {
        const { it, gen } = this;
        if (!it.opts.unevaluated)
          return;
        if (it.props !== true && schemaCxt.props !== void 0) {
          it.props = util_1.mergeEvaluated.props(gen, schemaCxt.props, it.props, toName);
        }
        if (it.items !== true && schemaCxt.items !== void 0) {
          it.items = util_1.mergeEvaluated.items(gen, schemaCxt.items, it.items, toName);
        }
      }
      mergeValidEvaluated(schemaCxt, valid) {
        const { it, gen } = this;
        if (it.opts.unevaluated && (it.props !== true || it.items !== true)) {
          gen.if(valid, () => this.mergeEvaluated(schemaCxt, codegen_1.Name));
          return true;
        }
      }
    };
    exports.KeywordCxt = KeywordCxt;
    function keywordCode(it, keyword, def, ruleType) {
      const cxt = new KeywordCxt(it, def, keyword);
      if ("code" in def) {
        def.code(cxt, ruleType);
      } else if (cxt.$data && def.validate) {
        (0, keyword_1.funcKeywordCode)(cxt, def);
      } else if ("macro" in def) {
        (0, keyword_1.macroKeywordCode)(cxt, def);
      } else if (def.compile || def.validate) {
        (0, keyword_1.funcKeywordCode)(cxt, def);
      }
    }
    var JSON_POINTER = /^\/(?:[^~]|~0|~1)*$/;
    var RELATIVE_JSON_POINTER = /^([0-9]+)(#|\/(?:[^~]|~0|~1)*)?$/;
    function getData($data, { dataLevel, dataNames, dataPathArr }) {
      let jsonPointer;
      let data;
      if ($data === "")
        return names_1.default.rootData;
      if ($data[0] === "/") {
        if (!JSON_POINTER.test($data))
          throw new Error(`Invalid JSON-pointer: ${$data}`);
        jsonPointer = $data;
        data = names_1.default.rootData;
      } else {
        const matches = RELATIVE_JSON_POINTER.exec($data);
        if (!matches)
          throw new Error(`Invalid JSON-pointer: ${$data}`);
        const up = +matches[1];
        jsonPointer = matches[2];
        if (jsonPointer === "#") {
          if (up >= dataLevel)
            throw new Error(errorMsg("property/index", up));
          return dataPathArr[dataLevel - up];
        }
        if (up > dataLevel)
          throw new Error(errorMsg("data", up));
        data = dataNames[dataLevel - up];
        if (!jsonPointer)
          return data;
      }
      let expr = data;
      const segments = jsonPointer.split("/");
      for (const segment of segments) {
        if (segment) {
          data = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)((0, util_1.unescapeJsonPointer)(segment))}`;
          expr = (0, codegen_1._)`${expr} && ${data}`;
        }
      }
      return expr;
      function errorMsg(pointerType, up) {
        return `Cannot access ${pointerType} ${up} levels up, current level is ${dataLevel}`;
      }
    }
    exports.getData = getData;
  }
});

// node_modules/ajv/dist/runtime/validation_error.js
var require_validation_error = __commonJS({
  "node_modules/ajv/dist/runtime/validation_error.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var ValidationError = class extends Error {
      constructor(errors) {
        super("validation failed");
        this.errors = errors;
        this.ajv = this.validation = true;
      }
    };
    exports.default = ValidationError;
  }
});

// node_modules/ajv/dist/compile/ref_error.js
var require_ref_error = __commonJS({
  "node_modules/ajv/dist/compile/ref_error.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var resolve_1 = require_resolve();
    var MissingRefError = class extends Error {
      constructor(resolver, baseId, ref, msg) {
        super(msg || `can't resolve reference ${ref} from id ${baseId}`);
        this.missingRef = (0, resolve_1.resolveUrl)(resolver, baseId, ref);
        this.missingSchema = (0, resolve_1.normalizeId)((0, resolve_1.getFullPath)(resolver, this.missingRef));
      }
    };
    exports.default = MissingRefError;
  }
});

// node_modules/ajv/dist/compile/index.js
var require_compile = __commonJS({
  "node_modules/ajv/dist/compile/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.resolveSchema = exports.getCompilingSchema = exports.resolveRef = exports.compileSchema = exports.SchemaEnv = void 0;
    var codegen_1 = require_codegen();
    var validation_error_1 = require_validation_error();
    var names_1 = require_names();
    var resolve_1 = require_resolve();
    var util_1 = require_util();
    var validate_1 = require_validate();
    var SchemaEnv = class {
      constructor(env) {
        var _a;
        this.refs = {};
        this.dynamicAnchors = {};
        let schema2;
        if (typeof env.schema == "object")
          schema2 = env.schema;
        this.schema = env.schema;
        this.schemaId = env.schemaId;
        this.root = env.root || this;
        this.baseId = (_a = env.baseId) !== null && _a !== void 0 ? _a : (0, resolve_1.normalizeId)(schema2 === null || schema2 === void 0 ? void 0 : schema2[env.schemaId || "$id"]);
        this.schemaPath = env.schemaPath;
        this.localRefs = env.localRefs;
        this.meta = env.meta;
        this.$async = schema2 === null || schema2 === void 0 ? void 0 : schema2.$async;
        this.refs = {};
      }
    };
    exports.SchemaEnv = SchemaEnv;
    function compileSchema(sch) {
      const _sch = getCompilingSchema.call(this, sch);
      if (_sch)
        return _sch;
      const rootId = (0, resolve_1.getFullPath)(this.opts.uriResolver, sch.root.baseId);
      const { es5, lines } = this.opts.code;
      const { ownProperties } = this.opts;
      const gen = new codegen_1.CodeGen(this.scope, { es5, lines, ownProperties });
      let _ValidationError;
      if (sch.$async) {
        _ValidationError = gen.scopeValue("Error", {
          ref: validation_error_1.default,
          code: (0, codegen_1._)`require("ajv/dist/runtime/validation_error").default`
        });
      }
      const validateName = gen.scopeName("validate");
      sch.validateName = validateName;
      const schemaCxt = {
        gen,
        allErrors: this.opts.allErrors,
        data: names_1.default.data,
        parentData: names_1.default.parentData,
        parentDataProperty: names_1.default.parentDataProperty,
        dataNames: [names_1.default.data],
        dataPathArr: [codegen_1.nil],
        // TODO can its length be used as dataLevel if nil is removed?
        dataLevel: 0,
        dataTypes: [],
        definedProperties: /* @__PURE__ */ new Set(),
        topSchemaRef: gen.scopeValue("schema", this.opts.code.source === true ? { ref: sch.schema, code: (0, codegen_1.stringify)(sch.schema) } : { ref: sch.schema }),
        validateName,
        ValidationError: _ValidationError,
        schema: sch.schema,
        schemaEnv: sch,
        rootId,
        baseId: sch.baseId || rootId,
        schemaPath: codegen_1.nil,
        errSchemaPath: sch.schemaPath || (this.opts.jtd ? "" : "#"),
        errorPath: (0, codegen_1._)`""`,
        opts: this.opts,
        self: this
      };
      let sourceCode;
      try {
        this._compilations.add(sch);
        (0, validate_1.validateFunctionCode)(schemaCxt);
        gen.optimize(this.opts.code.optimize);
        const validateCode = gen.toString();
        sourceCode = `${gen.scopeRefs(names_1.default.scope)}return ${validateCode}`;
        if (this.opts.code.process)
          sourceCode = this.opts.code.process(sourceCode, sch);
        const makeValidate = new Function(`${names_1.default.self}`, `${names_1.default.scope}`, sourceCode);
        const validate2 = makeValidate(this, this.scope.get());
        this.scope.value(validateName, { ref: validate2 });
        validate2.errors = null;
        validate2.schema = sch.schema;
        validate2.schemaEnv = sch;
        if (sch.$async)
          validate2.$async = true;
        if (this.opts.code.source === true) {
          validate2.source = { validateName, validateCode, scopeValues: gen._values };
        }
        if (this.opts.unevaluated) {
          const { props, items } = schemaCxt;
          validate2.evaluated = {
            props: props instanceof codegen_1.Name ? void 0 : props,
            items: items instanceof codegen_1.Name ? void 0 : items,
            dynamicProps: props instanceof codegen_1.Name,
            dynamicItems: items instanceof codegen_1.Name
          };
          if (validate2.source)
            validate2.source.evaluated = (0, codegen_1.stringify)(validate2.evaluated);
        }
        sch.validate = validate2;
        return sch;
      } catch (e) {
        delete sch.validate;
        delete sch.validateName;
        if (sourceCode)
          this.logger.error("Error compiling schema, function code:", sourceCode);
        throw e;
      } finally {
        this._compilations.delete(sch);
      }
    }
    exports.compileSchema = compileSchema;
    function resolveRef(root, baseId, ref) {
      var _a;
      ref = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, ref);
      const schOrFunc = root.refs[ref];
      if (schOrFunc)
        return schOrFunc;
      let _sch = resolve3.call(this, root, ref);
      if (_sch === void 0) {
        const schema2 = (_a = root.localRefs) === null || _a === void 0 ? void 0 : _a[ref];
        const { schemaId } = this.opts;
        if (schema2)
          _sch = new SchemaEnv({ schema: schema2, schemaId, root, baseId });
      }
      if (_sch === void 0)
        return;
      return root.refs[ref] = inlineOrCompile.call(this, _sch);
    }
    exports.resolveRef = resolveRef;
    function inlineOrCompile(sch) {
      if ((0, resolve_1.inlineRef)(sch.schema, this.opts.inlineRefs))
        return sch.schema;
      return sch.validate ? sch : compileSchema.call(this, sch);
    }
    function getCompilingSchema(schEnv) {
      for (const sch of this._compilations) {
        if (sameSchemaEnv(sch, schEnv))
          return sch;
      }
    }
    exports.getCompilingSchema = getCompilingSchema;
    function sameSchemaEnv(s1, s2) {
      return s1.schema === s2.schema && s1.root === s2.root && s1.baseId === s2.baseId;
    }
    function resolve3(root, ref) {
      let sch;
      while (typeof (sch = this.refs[ref]) == "string")
        ref = sch;
      return sch || this.schemas[ref] || resolveSchema.call(this, root, ref);
    }
    function resolveSchema(root, ref) {
      const p = this.opts.uriResolver.parse(ref);
      const refPath = (0, resolve_1._getFullPath)(this.opts.uriResolver, p);
      let baseId = (0, resolve_1.getFullPath)(this.opts.uriResolver, root.baseId, void 0);
      if (Object.keys(root.schema).length > 0 && refPath === baseId) {
        return getJsonPointer.call(this, p, root);
      }
      const id = (0, resolve_1.normalizeId)(refPath);
      const schOrRef = this.refs[id] || this.schemas[id];
      if (typeof schOrRef == "string") {
        const sch = resolveSchema.call(this, root, schOrRef);
        if (typeof (sch === null || sch === void 0 ? void 0 : sch.schema) !== "object")
          return;
        return getJsonPointer.call(this, p, sch);
      }
      if (typeof (schOrRef === null || schOrRef === void 0 ? void 0 : schOrRef.schema) !== "object")
        return;
      if (!schOrRef.validate)
        compileSchema.call(this, schOrRef);
      if (id === (0, resolve_1.normalizeId)(ref)) {
        const { schema: schema2 } = schOrRef;
        const { schemaId } = this.opts;
        const schId = schema2[schemaId];
        if (schId)
          baseId = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schId);
        return new SchemaEnv({ schema: schema2, schemaId, root, baseId });
      }
      return getJsonPointer.call(this, p, schOrRef);
    }
    exports.resolveSchema = resolveSchema;
    var PREVENT_SCOPE_CHANGE = /* @__PURE__ */ new Set([
      "properties",
      "patternProperties",
      "enum",
      "dependencies",
      "definitions"
    ]);
    function getJsonPointer(parsedRef, { baseId, schema: schema2, root }) {
      var _a;
      if (((_a = parsedRef.fragment) === null || _a === void 0 ? void 0 : _a[0]) !== "/")
        return;
      for (const part of parsedRef.fragment.slice(1).split("/")) {
        if (typeof schema2 === "boolean")
          return;
        const partSchema = schema2[(0, util_1.unescapeFragment)(part)];
        if (partSchema === void 0)
          return;
        schema2 = partSchema;
        const schId = typeof schema2 === "object" && schema2[this.opts.schemaId];
        if (!PREVENT_SCOPE_CHANGE.has(part) && schId) {
          baseId = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schId);
        }
      }
      let env;
      if (typeof schema2 != "boolean" && schema2.$ref && !(0, util_1.schemaHasRulesButRef)(schema2, this.RULES)) {
        const $ref = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schema2.$ref);
        env = resolveSchema.call(this, root, $ref);
      }
      const { schemaId } = this.opts;
      env = env || new SchemaEnv({ schema: schema2, schemaId, root, baseId });
      if (env.schema !== env.root.schema)
        return env;
      return void 0;
    }
  }
});

// node_modules/ajv/dist/refs/data.json
var require_data = __commonJS({
  "node_modules/ajv/dist/refs/data.json"(exports, module) {
    module.exports = {
      $id: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#",
      description: "Meta-schema for $data reference (JSON AnySchema extension proposal)",
      type: "object",
      required: ["$data"],
      properties: {
        $data: {
          type: "string",
          anyOf: [{ format: "relative-json-pointer" }, { format: "json-pointer" }]
        }
      },
      additionalProperties: false
    };
  }
});

// node_modules/fast-uri/lib/utils.js
var require_utils = __commonJS({
  "node_modules/fast-uri/lib/utils.js"(exports, module) {
    "use strict";
    var isUUID = RegExp.prototype.test.bind(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu);
    var isIPv4 = RegExp.prototype.test.bind(/^(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)$/u);
    var isPort = RegExp.prototype.test.bind(/^\d*$/u);
    var isHexPair = RegExp.prototype.test.bind(/^[\da-f]{2}$/iu);
    var isUnreserved = RegExp.prototype.test.bind(/^[\da-z\-._~]$/iu);
    var isPathCharacter = RegExp.prototype.test.bind(/^[A-Za-z0-9\-._~!$&'()*+,;=:@/]$/u);
    var isQueryFragmentCharacter = RegExp.prototype.test.bind(/^[A-Za-z0-9\-._~!$&'()*+,;=:@/?]$/u);
    var isUserinfoCharacter = RegExp.prototype.test.bind(/^[A-Za-z0-9\-._~!$&'()*+,;=:]$/u);
    var BYTE_HEX = new Array(256);
    {
      const HEX_DIGITS = "0123456789ABCDEF";
      for (let i = 0; i < 256; i++) {
        BYTE_HEX[i] = "%" + HEX_DIGITS[i >> 4] + HEX_DIGITS[i & 15];
      }
    }
    function percentEncodeNonAscii(cp) {
      if (cp < 2048) {
        return BYTE_HEX[192 | cp >> 6] + BYTE_HEX[128 | cp & 63];
      }
      if (cp < 65536) {
        return BYTE_HEX[224 | cp >> 12] + BYTE_HEX[128 | cp >> 6 & 63] + BYTE_HEX[128 | cp & 63];
      }
      return BYTE_HEX[240 | cp >> 18] + BYTE_HEX[128 | cp >> 12 & 63] + BYTE_HEX[128 | cp >> 6 & 63] + BYTE_HEX[128 | cp & 63];
    }
    function stringArrayToHexStripped(input) {
      let acc = "";
      let code = 0;
      let i = 0;
      for (i = 0; i < input.length; i++) {
        code = input[i].charCodeAt(0);
        if (code === 48) {
          continue;
        }
        if (!(code >= 48 && code <= 57 || code >= 65 && code <= 70 || code >= 97 && code <= 102)) {
          return "";
        }
        acc += input[i];
        break;
      }
      for (i += 1; i < input.length; i++) {
        code = input[i].charCodeAt(0);
        if (!(code >= 48 && code <= 57 || code >= 65 && code <= 70 || code >= 97 && code <= 102)) {
          return "";
        }
        acc += input[i];
      }
      return acc;
    }
    var isHextet = RegExp.prototype.test.bind(/^[\dA-Fa-f]{1,4}$/);
    var isIPvFuture = RegExp.prototype.test.bind(/^[vV][\dA-Fa-f]+\.[A-Za-z\d\-._~!$&'()*+,;=:]+$/);
    var isZoneCharacter = RegExp.prototype.test.bind(/^[A-Za-z\d\-._~]$/);
    var nonSimpleDomain = RegExp.prototype.test.bind(/[^!"$&'()*+,\-.;=_`a-z{}~]/u);
    function isZoneIdentifier(zone) {
      if (zone.length === 0) return false;
      for (let i = 0; i < zone.length; i++) {
        if (isZoneCharacter(zone[i])) continue;
        if (zone[i] === "%" && i + 2 < zone.length && isHexPair(zone.slice(i + 1, i + 3))) {
          i += 2;
          continue;
        }
        return false;
      }
      return true;
    }
    function compressIPv6ZeroRun(hextets) {
      let bestStart = -1;
      let bestLength = 0;
      let runStart = -1;
      let runLength = 0;
      for (let i = 0; i < hextets.length; i++) {
        if (hextets[i] === "0") {
          if (runStart === -1) runStart = i;
          runLength++;
          if (runLength > bestLength) {
            bestLength = runLength;
            bestStart = runStart;
          }
        } else {
          runStart = -1;
          runLength = 0;
        }
      }
      if (bestLength < 2) return hextets.join(":");
      const head = hextets.slice(0, bestStart).join(":");
      const tail = hextets.slice(bestStart + bestLength).join(":");
      return head + "::" + tail;
    }
    function normalizeIPv6Address(input) {
      const compression = input.indexOf("::");
      if (compression !== -1 && input.indexOf("::", compression + 1) !== -1) return void 0;
      const left = compression === -1 ? input.split(":") : input.slice(0, compression).split(":");
      const right = compression === -1 ? [] : input.slice(compression + 2).split(":");
      if (compression !== -1) {
        if (left.length === 1 && left[0] === "") left.length = 0;
        if (right.length === 1 && right[0] === "") right.length = 0;
      }
      const parts = left.concat(right);
      let hextetCount = 0;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part === "") return void 0;
        if (part.indexOf(".") !== -1) {
          if (i !== parts.length - 1 || compression !== -1 && right.length === 0 || !isIPv4(part)) return void 0;
          hextetCount += 2;
          continue;
        }
        if (!isHextet(part)) return void 0;
        parts[i] = parseInt(part, 16).toString(16);
        hextetCount++;
      }
      if (compression === -1) {
        if (hextetCount !== 8) return void 0;
        return compressIPv6ZeroRun(parts);
      }
      if (hextetCount >= 8) return void 0;
      const expanded = parts.slice(0, left.length);
      for (let i = hextetCount; i < 8; i++) expanded.push("0");
      for (let i = left.length; i < parts.length; i++) expanded.push(parts[i]);
      return compressIPv6ZeroRun(expanded);
    }
    function normalizeIPv6(host) {
      const bracketed = host[0] === "[" && host[host.length - 1] === "]";
      const hasBracket = host[0] === "[" || host[host.length - 1] === "]";
      if (hasBracket && !bracketed) return { host, isIPV6: false, error: true };
      let input = bracketed ? host.slice(1, -1) : host;
      if (bracketed && isIPvFuture(input)) {
        input = input.toLowerCase();
        return { host: `[${input}]`, escapedHost: input, isIPV6: false, isIPVFuture: true };
      }
      if (findToken(input, ":") < 2) {
        return { host, isIPV6: false, error: bracketed };
      }
      let zoneIdentifier = "";
      const zoneSeparator = input.indexOf("%");
      if (zoneSeparator !== -1) {
        const separatorLength = input.slice(zoneSeparator, zoneSeparator + 3).toLowerCase() === "%25" ? 3 : 1;
        zoneIdentifier = input.slice(zoneSeparator + separatorLength);
        if (!isZoneIdentifier(zoneIdentifier)) return { host, isIPV6: false, error: true };
        input = input.slice(0, zoneSeparator);
      }
      const address = normalizeIPv6Address(input);
      if (address === void 0) return { host, isIPV6: false, error: true };
      return {
        host: address + (zoneIdentifier ? "%" + zoneIdentifier : ""),
        escapedHost: address + (zoneIdentifier ? "%25" + zoneIdentifier : ""),
        isIPV6: true
      };
    }
    function findToken(str, token) {
      let ind = 0;
      for (let i = 0; i < str.length; i++) {
        if (str[i] === token) ind++;
      }
      return ind;
    }
    function removeDotSegments(path) {
      let input = path;
      const output = [];
      let nextSlash = -1;
      let len = 0;
      while (len = input.length) {
        if (len === 1) {
          if (input === ".") {
            break;
          } else if (input === "/") {
            output.push("/");
            break;
          } else {
            output.push(input);
            break;
          }
        } else if (len === 2) {
          if (input[0] === ".") {
            if (input[1] === ".") {
              break;
            } else if (input[1] === "/") {
              input = input.slice(2);
              continue;
            }
          } else if (input[0] === "/") {
            if (input[1] === "." || input[1] === "/") {
              output.push("/");
              break;
            }
          }
        } else if (len === 3) {
          if (input === "/..") {
            if (output.length !== 0) {
              output.pop();
            }
            output.push("/");
            break;
          }
        }
        if (input[0] === ".") {
          if (input[1] === ".") {
            if (input[2] === "/") {
              input = input.slice(3);
              continue;
            }
          } else if (input[1] === "/") {
            input = input.slice(2);
            continue;
          }
        } else if (input[0] === "/") {
          if (input[1] === ".") {
            if (input[2] === "/") {
              input = input.slice(2);
              continue;
            } else if (input[2] === ".") {
              if (input[3] === "/") {
                input = input.slice(3);
                if (output.length !== 0) {
                  output.pop();
                }
                continue;
              }
            }
          }
        }
        if ((nextSlash = input.indexOf("/", 1)) === -1) {
          output.push(input);
          break;
        } else {
          output.push(input.slice(0, nextSlash));
          input = input.slice(nextSlash);
        }
      }
      return output.join("");
    }
    function removeDotSegmentsRelative(path) {
      if (path === "" || path[0] === "/") {
        return removeDotSegments(path);
      }
      const segments = path.split("/");
      const last = segments.length - 1;
      const output = [];
      let trailingDirectory = false;
      for (let i = 0; i <= last; i++) {
        const segment = segments[i];
        if (segment === "." || segment === "..") {
          if (segment === "..") {
            if (output.length !== 0 && output[output.length - 1] !== "..") {
              output.pop();
            } else {
              output.push("..");
            }
          }
          trailingDirectory = i === last;
        } else {
          output.push(segment);
        }
      }
      if (trailingDirectory && output[output.length - 1] !== "..") {
        output.push("");
      }
      if (output.length === 0 || output[0] === "" || output[0].includes(":")) {
        output.unshift(".");
      }
      return output.join("/");
    }
    var HOST_DELIMS = { "@": "%40", "/": "%2F", "?": "%3F", "#": "%23", ":": "%3A" };
    var HOST_DELIM_RE = /[@/?#:]/g;
    var HOST_DELIM_NO_COLON_RE = /[@/?#]/g;
    function reescapeHostDelimiters(host, isIP) {
      const re = isIP ? HOST_DELIM_NO_COLON_RE : HOST_DELIM_RE;
      re.lastIndex = 0;
      return host.replace(re, (ch) => HOST_DELIMS[ch]);
    }
    function normalizePercentEncoding(input, decodeUnreserved = false) {
      if (input.indexOf("%") === -1) {
        return input;
      }
      let output = "";
      for (let i = 0; i < input.length; i++) {
        if (input[i] === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            const normalizedHex = hex.toUpperCase();
            const decoded = String.fromCharCode(parseInt(normalizedHex, 16));
            if (decodeUnreserved && isUnreserved(decoded)) {
              output += decoded;
            } else {
              output += "%" + normalizedHex;
            }
            i += 2;
            continue;
          }
        }
        output += input[i];
      }
      return output;
    }
    function normalizePathEncoding(input) {
      let output = "";
      for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (ch === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            const normalizedHex = hex.toUpperCase();
            const decoded = String.fromCharCode(parseInt(normalizedHex, 16));
            if (decoded !== "." && isUnreserved(decoded)) {
              output += decoded;
            } else {
              output += "%" + normalizedHex;
            }
            i += 2;
            continue;
          }
        }
        if (isPathCharacter(ch)) {
          output += ch;
        } else {
          const code = input.charCodeAt(i);
          if (code < 128) {
            output += isEscapeSafe(code) ? ch : BYTE_HEX[code];
          } else if (code < 55296 || code > 57343) {
            output += percentEncodeNonAscii(code);
          } else if (code <= 56319 && i + 1 < input.length) {
            const low = input.charCodeAt(i + 1);
            if (low >= 56320 && low <= 57343) {
              output += percentEncodeNonAscii(65536 + (code - 55296 << 10) + (low - 56320));
              i++;
            } else {
              output += percentEncodeNonAscii(65533);
            }
          } else {
            output += percentEncodeNonAscii(65533);
          }
        }
      }
      return output;
    }
    function serializePathEncoding(input, pathNoScheme = false) {
      let output = "";
      let firstSegment = pathNoScheme && input[0] !== "/";
      for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (ch === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            output += "%" + hex.toUpperCase();
            i += 2;
            continue;
          }
        }
        if (ch === "/") {
          firstSegment = false;
        }
        if (isPathCharacter(ch) && (ch !== ":" || !firstSegment)) {
          output += ch;
        } else {
          const code = input.charCodeAt(i);
          if (code < 128) {
            output += BYTE_HEX[code];
          } else if (code < 55296 || code > 57343) {
            output += percentEncodeNonAscii(code);
          } else if (code <= 56319 && i + 1 < input.length) {
            const low = input.charCodeAt(i + 1);
            if (low >= 56320 && low <= 57343) {
              output += percentEncodeNonAscii(65536 + (code - 55296 << 10) + (low - 56320));
              i++;
            } else {
              output += percentEncodeNonAscii(65533);
            }
          } else {
            output += percentEncodeNonAscii(65533);
          }
        }
      }
      return output;
    }
    function encodeComponent(input, isAllowed) {
      let output = "";
      for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (ch === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            output += "%" + hex.toUpperCase();
            i += 2;
            continue;
          }
        }
        if (isAllowed(ch)) {
          output += ch;
        } else {
          const code = input.charCodeAt(i);
          if (code < 128) {
            output += BYTE_HEX[code];
          } else if (code < 55296 || code > 57343) {
            output += percentEncodeNonAscii(code);
          } else if (code <= 56319 && i + 1 < input.length) {
            const low = input.charCodeAt(i + 1);
            if (low >= 56320 && low <= 57343) {
              output += percentEncodeNonAscii(65536 + (code - 55296 << 10) + (low - 56320));
              i++;
            } else {
              output += percentEncodeNonAscii(65533);
            }
          } else {
            output += percentEncodeNonAscii(65533);
          }
        }
      }
      return output;
    }
    function encodeUserinfo(input) {
      return encodeComponent(input, isUserinfoCharacter);
    }
    function encodeQuery(input) {
      return encodeComponent(input, isQueryFragmentCharacter);
    }
    function encodeFragment(input) {
      return encodeComponent(input, isQueryFragmentCharacter);
    }
    function isEscapeSafe(cp) {
      return cp >= 48 && cp <= 57 || cp >= 65 && cp <= 90 || cp >= 97 && cp <= 122 || cp === 42 || cp === 43 || cp === 45 || cp === 46 || cp === 47 || cp === 64 || cp === 95;
    }
    function normalizeQueryFragmentEncoding(input) {
      let output = "";
      for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (ch === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            const normalizedHex = hex.toUpperCase();
            const decoded = String.fromCharCode(parseInt(normalizedHex, 16));
            if (isUnreserved(decoded)) {
              output += decoded;
            } else {
              output += "%" + normalizedHex;
            }
            i += 2;
            continue;
          }
        }
        if (isQueryFragmentCharacter(ch)) {
          output += ch;
        } else {
          const code = input.charCodeAt(i);
          if (code < 128) {
            output += isEscapeSafe(code) ? ch : BYTE_HEX[code];
          } else if (code < 55296 || code > 57343) {
            output += percentEncodeNonAscii(code);
          } else if (code <= 56319 && i + 1 < input.length) {
            const low = input.charCodeAt(i + 1);
            if (low >= 56320 && low <= 57343) {
              output += percentEncodeNonAscii(65536 + (code - 55296 << 10) + (low - 56320));
              i++;
            } else {
              output += percentEncodeNonAscii(65533);
            }
          } else {
            output += percentEncodeNonAscii(65533);
          }
        }
      }
      return output;
    }
    function escapePreservingEscapes(input) {
      let output = "";
      for (let i = 0; i < input.length; i++) {
        if (input[i] === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            output += "%" + hex.toUpperCase();
            i += 2;
            continue;
          }
        }
        output += escape(input[i]);
      }
      return output;
    }
    function recomposeAuthority(component) {
      const uriTokens = [];
      if (component.userinfo !== void 0) {
        uriTokens.push(encodeUserinfo(component.userinfo));
        uriTokens.push("@");
      }
      if (component.host !== void 0) {
        let host = component.host;
        if (!isIPv4(host)) {
          let ipV6res = normalizeIPv6(host);
          if (ipV6res.isIPV6 !== true && ipV6res.isIPVFuture !== true) {
            host = normalizePercentEncoding(host, true);
            ipV6res = normalizeIPv6(host);
          }
          if (ipV6res.isIPV6 === true || ipV6res.isIPVFuture === true) {
            host = `[${ipV6res.escapedHost}]`;
          } else {
            host = reescapeHostDelimiters(host, false);
          }
        }
        uriTokens.push(host);
      }
      if (typeof component.port === "number" || typeof component.port === "string") {
        const port = String(component.port);
        if (!isPort(port)) {
          throw new TypeError("URI port is malformed.");
        }
        uriTokens.push(":");
        uriTokens.push(port);
      }
      return uriTokens.length ? uriTokens.join("") : void 0;
    }
    module.exports = {
      nonSimpleDomain,
      recomposeAuthority,
      reescapeHostDelimiters,
      normalizePercentEncoding,
      normalizePathEncoding,
      serializePathEncoding,
      normalizeQueryFragmentEncoding,
      encodeUserinfo,
      encodeQuery,
      encodeFragment,
      escapePreservingEscapes,
      removeDotSegments,
      removeDotSegmentsRelative,
      isIPv4,
      isUUID,
      normalizeIPv6,
      stringArrayToHexStripped
    };
  }
});

// node_modules/fast-uri/lib/schemes.js
var require_schemes = __commonJS({
  "node_modules/fast-uri/lib/schemes.js"(exports, module) {
    "use strict";
    var { isUUID } = require_utils();
    var URN_REG = /^([\da-z][\d\-a-z]{0,31}):((?:[\w!$'()*+,\-./:;=@]|%[\da-f]{2})+)$/iu;
    var supportedSchemeNames = (
      /** @type {const} */
      [
        "http",
        "https",
        "ws",
        "wss",
        "urn",
        "urn:uuid"
      ]
    );
    function isValidSchemeName(name2) {
      return supportedSchemeNames.indexOf(
        /** @type {*} */
        name2
      ) !== -1;
    }
    function wsIsSecure(wsComponent) {
      if (wsComponent.secure === true) {
        return true;
      } else if (wsComponent.secure === false) {
        return false;
      } else if (wsComponent.scheme) {
        return wsComponent.scheme.length === 3 && (wsComponent.scheme[0] === "w" || wsComponent.scheme[0] === "W") && (wsComponent.scheme[1] === "s" || wsComponent.scheme[1] === "S") && (wsComponent.scheme[2] === "s" || wsComponent.scheme[2] === "S");
      } else {
        return false;
      }
    }
    function httpParse(component) {
      if (!component.host) {
        component.error = component.error || "HTTP URIs must have a host.";
      }
      return component;
    }
    function httpSerialize(component) {
      const secure = String(component.scheme).toLowerCase() === "https";
      if (component.port === (secure ? 443 : 80) || component.port === "") {
        component.port = void 0;
      }
      if (!component.path) {
        component.path = "/";
      }
      return component;
    }
    function wsParse(wsComponent) {
      wsComponent.secure = wsIsSecure(wsComponent);
      wsComponent.resourceName = (wsComponent.path || "/") + (wsComponent.query ? "?" + wsComponent.query : "");
      wsComponent.path = void 0;
      wsComponent.query = void 0;
      return wsComponent;
    }
    function wsSerialize(wsComponent) {
      if (wsComponent.port === (wsIsSecure(wsComponent) ? 443 : 80) || wsComponent.port === "") {
        wsComponent.port = void 0;
      }
      if (typeof wsComponent.secure === "boolean") {
        wsComponent.scheme = wsComponent.secure ? "wss" : "ws";
        wsComponent.secure = void 0;
      }
      if (wsComponent.resourceName) {
        const queryIndex = wsComponent.resourceName.indexOf("?");
        const path = queryIndex === -1 ? wsComponent.resourceName : wsComponent.resourceName.slice(0, queryIndex);
        wsComponent.path = path && path !== "/" ? path : void 0;
        wsComponent.query = queryIndex === -1 ? void 0 : wsComponent.resourceName.slice(queryIndex + 1);
        wsComponent.resourceName = void 0;
      }
      wsComponent.fragment = void 0;
      return wsComponent;
    }
    function urnParse(urnComponent, options) {
      if (!urnComponent.path) {
        urnComponent.error = "URN can not be parsed";
        return urnComponent;
      }
      const matches = urnComponent.path.match(URN_REG);
      if (matches && matches[0] === urnComponent.path) {
        const scheme = options.scheme || urnComponent.scheme || "urn";
        urnComponent.nid = matches[1].toLowerCase();
        urnComponent.nss = matches[2];
        const urnScheme = `${scheme}:${options.nid || urnComponent.nid}`;
        const schemeHandler = getSchemeHandler(urnScheme);
        urnComponent.path = void 0;
        if (schemeHandler) {
          urnComponent = schemeHandler.parse(urnComponent, options);
        }
      } else {
        urnComponent.error = urnComponent.error || "URN can not be parsed.";
      }
      return urnComponent;
    }
    function urnSerialize(urnComponent, options) {
      if (urnComponent.nid === void 0) {
        throw new Error("URN without nid cannot be serialized");
      }
      const scheme = options.scheme || urnComponent.scheme || "urn";
      const nid = urnComponent.nid.toLowerCase();
      const urnScheme = `${scheme}:${options.nid || nid}`;
      const schemeHandler = getSchemeHandler(urnScheme);
      if (schemeHandler) {
        urnComponent = schemeHandler.serialize(urnComponent, options);
      }
      const uriComponent = urnComponent;
      const nss = urnComponent.nss;
      uriComponent.path = `${nid || options.nid}:${nss}`;
      options.skipEscape = true;
      return uriComponent;
    }
    function urnuuidParse(urnComponent, options) {
      const uuidComponent = urnComponent;
      uuidComponent.uuid = uuidComponent.nss;
      uuidComponent.nss = void 0;
      if (!options.tolerant && (!uuidComponent.uuid || !isUUID(uuidComponent.uuid))) {
        uuidComponent.error = uuidComponent.error || "UUID is not valid.";
      }
      return uuidComponent;
    }
    function urnuuidSerialize(uuidComponent) {
      const urnComponent = uuidComponent;
      urnComponent.nss = (uuidComponent.uuid || "").toLowerCase();
      return urnComponent;
    }
    var http = (
      /** @type {SchemeHandler} */
      {
        scheme: "http",
        domainHost: true,
        parse: httpParse,
        serialize: httpSerialize
      }
    );
    var https = (
      /** @type {SchemeHandler} */
      {
        scheme: "https",
        domainHost: http.domainHost,
        parse: httpParse,
        serialize: httpSerialize
      }
    );
    var ws = (
      /** @type {SchemeHandler} */
      {
        scheme: "ws",
        domainHost: true,
        parse: wsParse,
        serialize: wsSerialize
      }
    );
    var wss = (
      /** @type {SchemeHandler} */
      {
        scheme: "wss",
        domainHost: ws.domainHost,
        parse: ws.parse,
        serialize: ws.serialize
      }
    );
    var urn = (
      /** @type {SchemeHandler} */
      {
        scheme: "urn",
        parse: urnParse,
        serialize: urnSerialize,
        skipNormalize: true
      }
    );
    var urnuuid = (
      /** @type {SchemeHandler} */
      {
        scheme: "urn:uuid",
        parse: urnuuidParse,
        serialize: urnuuidSerialize,
        skipNormalize: true
      }
    );
    var SCHEMES = (
      /** @type {Record<SchemeName, SchemeHandler>} */
      {
        http,
        https,
        ws,
        wss,
        urn,
        "urn:uuid": urnuuid
      }
    );
    Object.setPrototypeOf(SCHEMES, null);
    function getSchemeHandler(scheme) {
      return scheme && (SCHEMES[
        /** @type {SchemeName} */
        scheme
      ] || SCHEMES[
        /** @type {SchemeName} */
        scheme.toLowerCase()
      ]) || void 0;
    }
    module.exports = {
      wsIsSecure,
      SCHEMES,
      isValidSchemeName,
      getSchemeHandler
    };
  }
});

// node_modules/fast-uri/index.js
var require_fast_uri = __commonJS({
  "node_modules/fast-uri/index.js"(exports, module) {
    "use strict";
    var { normalizeIPv6, removeDotSegments, removeDotSegmentsRelative, recomposeAuthority, normalizePercentEncoding, normalizePathEncoding, serializePathEncoding, normalizeQueryFragmentEncoding, encodeQuery, encodeFragment, reescapeHostDelimiters, isIPv4, nonSimpleDomain } = require_utils();
    var { SCHEMES, getSchemeHandler } = require_schemes();
    var VALID_SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*$/u;
    var MALFORMED_SCHEME_ERROR = "URI scheme is malformed.";
    var MALFORMED_HOST_ERROR = "URI host is malformed.";
    var FORBIDDEN_DOMAIN_HOST_CHARACTER = /[\0-\x20"#/:<>?@[\\\]^`{|}\x7F]/u;
    function validateScheme(scheme) {
      const stringScheme = String(scheme);
      if (!VALID_SCHEME.test(stringScheme)) {
        throw new TypeError(MALFORMED_SCHEME_ERROR);
      }
      return stringScheme;
    }
    function normalize(uri, options) {
      if (typeof uri === "string") {
        uri = /** @type {T} */
        normalizeString(uri, options);
      } else if (typeof uri === "object") {
        uri = /** @type {T} */
        parse(serialize(uri, options), options);
      }
      return uri;
    }
    function resolve3(baseURI, relativeURI, options) {
      const schemelessOptions = options ? Object.assign({ scheme: "null" }, options) : { scheme: "null" };
      const {
        parsed: baseParsed,
        malformedAuthorityOrPort: baseMalformed,
        malformedPercentEncoding: baseMalformedPercentEncoding,
        malformedSchemeSpecific: baseMalformedSchemeSpecific,
        malformedHost: baseMalformedHost,
        malformedScheme: baseMalformedScheme
      } = parseWithStatus(baseURI, schemelessOptions);
      const {
        parsed: relativeParsed,
        malformedAuthorityOrPort: relativeMalformed,
        malformedPercentEncoding: relativeMalformedPercentEncoding,
        malformedSchemeSpecific: relativeMalformedSchemeSpecific,
        malformedHost: relativeMalformedHost,
        malformedScheme: relativeMalformedScheme
      } = parseWithStatus(relativeURI, schemelessOptions);
      if (baseMalformed || relativeMalformed || baseMalformedPercentEncoding || relativeMalformedPercentEncoding || baseMalformedSchemeSpecific || relativeMalformedSchemeSpecific || baseMalformedHost || relativeMalformedHost || baseMalformedScheme || relativeMalformedScheme) {
        throw new Error(baseParsed.error || relativeParsed.error || "URI is malformed.");
      }
      const resolved = resolveComponent(baseParsed, relativeParsed, schemelessOptions, true);
      const resolvedSchemeHandler = getSchemeHandler(options && options.scheme || resolved.scheme);
      const resolvedHost = resolved.host;
      const resolvedHostIsIP = resolvedHost !== void 0 && resolvedHost !== "" && (isIPv4(resolvedHost) || normalizeIPv6(resolvedHost).isIPV6);
      if (hasForbiddenDomainHost(resolved, options || {}, resolvedSchemeHandler, resolvedHostIsIP)) {
        throw new Error(MALFORMED_HOST_ERROR);
      }
      canonicalizeHost(resolved, options || {}, resolvedSchemeHandler, resolvedHostIsIP);
      const encodedASCIIHost = resolvedHost && resolvedHost.indexOf("%") !== -1 && !new RegExp("\\P{ASCII}", "u").test(resolvedHost);
      if (resolved.error && !encodedASCIIHost) {
        throw new Error(resolved.error);
      }
      schemelessOptions.skipEscape = true;
      return serialize(resolved, schemelessOptions);
    }
    function resolveComponent(base, relative, options, skipNormalization) {
      const target = {};
      if (!skipNormalization) {
        base = parse(serialize(base, options), options);
        relative = parse(serialize(relative, options), options);
      }
      options = options || {};
      if (!options.tolerant && relative.scheme) {
        target.scheme = relative.scheme;
        target.userinfo = relative.userinfo;
        target.host = relative.host;
        target.port = relative.port;
        target.path = removeDotSegments(relative.path || "");
        target.query = relative.query;
      } else {
        if (relative.userinfo !== void 0 || relative.host !== void 0 || relative.port !== void 0) {
          target.userinfo = relative.userinfo;
          target.host = relative.host;
          target.port = relative.port;
          target.path = removeDotSegments(relative.path || "");
          target.query = relative.query;
        } else {
          if (!relative.path) {
            target.path = base.path;
            if (relative.query !== void 0) {
              target.query = relative.query;
            } else {
              target.query = base.query;
            }
          } else {
            if (relative.path[0] === "/") {
              target.path = removeDotSegments(relative.path);
            } else {
              const baseHasAuthority = base.userinfo !== void 0 || base.host !== void 0 || base.port !== void 0;
              if (baseHasAuthority && !base.path) {
                target.path = "/" + relative.path;
              } else if (!base.path) {
                target.path = relative.path;
              } else {
                target.path = base.path.slice(0, base.path.lastIndexOf("/") + 1) + relative.path;
              }
              target.path = base.scheme === void 0 && !baseHasAuthority && target.path[0] !== "/" ? removeDotSegmentsRelative(target.path) : removeDotSegments(target.path);
            }
            target.query = relative.query;
          }
          target.userinfo = base.userinfo;
          target.host = base.host;
          target.port = base.port;
        }
        target.scheme = base.scheme;
      }
      target.fragment = relative.fragment;
      return target;
    }
    function equal(uriA, uriB, options) {
      const normalizedA = normalizeComparableURI(uriA, options);
      const normalizedB = normalizeComparableURI(uriB, options);
      return normalizedA !== void 0 && normalizedB !== void 0 && normalizedA === normalizedB;
    }
    function serialize(cmpts, opts) {
      const component = {
        host: cmpts.host,
        scheme: cmpts.scheme,
        userinfo: cmpts.userinfo,
        port: cmpts.port,
        path: cmpts.path,
        query: cmpts.query,
        nid: cmpts.nid,
        nss: cmpts.nss,
        uuid: cmpts.uuid,
        fragment: cmpts.fragment,
        reference: cmpts.reference,
        resourceName: cmpts.resourceName,
        secure: cmpts.secure,
        error: ""
      };
      const options = Object.assign({}, opts);
      const uriTokens = [];
      if (component.scheme) {
        component.scheme = validateScheme(component.scheme);
      }
      const schemeHandler = getSchemeHandler(options.scheme || component.scheme);
      if (schemeHandler && schemeHandler.serialize) schemeHandler.serialize(component, options);
      const hasAuthority = component.userinfo !== void 0 || component.host !== void 0 || component.port !== void 0;
      const schemelessReference = (component.scheme === void 0 || options.reference === "suffix") && !hasAuthority;
      const pathNoScheme = !options.skipEscape && schemelessReference;
      if (component.path !== void 0) {
        if (!options.skipEscape) {
          component.path = serializePathEncoding(component.path, pathNoScheme);
        } else {
          component.path = normalizePercentEncoding(component.path);
        }
      }
      if (options.reference !== "suffix" && component.scheme) {
        component.scheme = validateScheme(component.scheme);
        uriTokens.push(component.scheme, ":");
      }
      const authority = recomposeAuthority(component);
      if (authority !== void 0) {
        if (options.reference !== "suffix") {
          uriTokens.push("//");
        }
        uriTokens.push(authority);
        if (component.path && component.path[0] !== "/") {
          uriTokens.push("/");
        }
      }
      if (component.path !== void 0) {
        let s = component.path;
        if (!options.absolutePath && (!schemeHandler || !schemeHandler.absolutePath)) {
          s = schemelessReference && s[0] !== "/" ? removeDotSegmentsRelative(s) : removeDotSegments(s);
        }
        if (schemelessReference) {
          s = serializePathEncoding(s, true);
        }
        if (authority === void 0 && s[0] === "/" && s[1] === "/") {
          s = "/%2F" + s.slice(2);
        }
        uriTokens.push(s);
      }
      if (component.query !== void 0) {
        uriTokens.push("?", encodeQuery(component.query));
      }
      if (component.fragment !== void 0) {
        uriTokens.push("#", encodeFragment(component.fragment));
      }
      return uriTokens.join("");
    }
    var URI_PARSE = /^(?:([^#/:?]+):)?(?:\/\/((?:([^#/?@]*)@)?(\[[^#/?\]]+\]|[^#/:?]*)(?::(\d*))?))?([^#?]*)(?:\?([^#]*))?(?:#((?:.|[\n\r])*))?/u;
    var AUTHORITY_PREFIX = /^(?:[^#/:?]+:)?\/\/([^/?#]*)/;
    var AUTHORITY_INTRODUCER_REGION = /^(?:[^#/:?]+:)?([/\\\t\n\r]*)/;
    function getParseError(parsed, matches) {
      if (matches[2] !== void 0 && parsed.path && parsed.path[0] !== "/") {
        return 'URI path must start with "/" when authority is present.';
      }
      if (typeof parsed.port === "number" && (parsed.port < 0 || parsed.port > 65535)) {
        return "URI port is malformed.";
      }
      return void 0;
    }
    function hasMalformedPercentEncoding(component) {
      if (component === void 0) return false;
      let percent = component.indexOf("%");
      while (percent !== -1) {
        if (percent + 2 >= component.length || !/^[\da-f]{2}$/iu.test(component.slice(percent + 1, percent + 3))) {
          return true;
        }
        percent = component.indexOf("%", percent + 3);
      }
      return false;
    }
    function isIPLiteral(host) {
      return host[0] === "[" && host[host.length - 1] === "]";
    }
    function hasMalformedComponentPercentEncoding(matches) {
      const host = matches[4];
      return hasMalformedPercentEncoding(matches[3]) || host !== void 0 && !isIPLiteral(host) && hasMalformedPercentEncoding(host) || hasMalformedPercentEncoding(matches[6]) || hasMalformedPercentEncoding(matches[7]) || hasMalformedPercentEncoding(matches[8]);
    }
    function canonicalizeHost(parsed, options, schemeHandler, isIP) {
      if (hasForbiddenDomainHost(parsed, options, schemeHandler, isIP)) {
        parsed.error = parsed.error || MALFORMED_HOST_ERROR;
        return true;
      }
      if (!options.unicodeSupport && (!schemeHandler || !schemeHandler.unicodeSupport) && parsed.host && !isIPLiteral(parsed.host) && (options.domainHost || schemeHandler && schemeHandler.domainHost) && isIP === false && nonSimpleDomain(parsed.host)) {
        let url;
        try {
          url = new URL("http://" + parsed.host);
        } catch (e) {
          parsed.error = parsed.error || "Host's domain name can not be converted to ASCII: " + e;
          return true;
        }
        if (!isHostOnlyURL(url)) {
          parsed.error = parsed.error || MALFORMED_HOST_ERROR;
          return true;
        }
        parsed.host = url.hostname;
      }
      return false;
    }
    function hasForbiddenDomainHost(parsed, options, schemeHandler, isIP) {
      return Boolean(
        parsed.host && isIP === false && !isIPLiteral(parsed.host) && (options.domainHost || schemeHandler && schemeHandler.domainHost) && FORBIDDEN_DOMAIN_HOST_CHARACTER.test(parsed.host)
      );
    }
    function isHostOnlyURL(url) {
      return url.username === "" && url.password === "" && url.port === "" && url.pathname === "/" && url.search === "" && url.hash === "" && url.hostname !== "";
    }
    function parseWithStatus(uri, opts) {
      const options = Object.assign({}, opts);
      const parsed = {
        scheme: void 0,
        userinfo: void 0,
        host: "",
        port: void 0,
        path: "",
        query: void 0,
        fragment: void 0
      };
      let malformedAuthorityOrPort = false;
      let malformedPercentEncoding = false;
      let malformedSchemeSpecific = false;
      let malformedHost = false;
      let malformedIPLiteral = false;
      let malformedScheme = false;
      let isIP = false;
      if (options.reference === "suffix") {
        if (options.scheme) {
          uri = options.scheme + ":" + uri;
        } else {
          uri = "//" + uri;
        }
      }
      const authorityMatch = uri.match(AUTHORITY_PREFIX);
      if (authorityMatch !== null && authorityMatch[1].indexOf("\\") !== -1) {
        parsed.error = "URI authority must not contain a literal backslash.";
        malformedAuthorityOrPort = true;
      }
      const introducerMatch = uri.match(AUTHORITY_INTRODUCER_REGION);
      if (introducerMatch !== null) {
        const region = introducerMatch[1];
        const normalizedRegion = region.replace(/[\t\n\r]/g, "");
        if (normalizedRegion.length >= 2) {
          if (normalizedRegion.slice(0, 2) !== "//") {
            parsed.error = parsed.error || "URI authority must not contain a literal backslash.";
            malformedAuthorityOrPort = true;
          } else if (region.length !== normalizedRegion.length) {
            parsed.error = parsed.error || "URI authority introducer must not contain whitespace.";
            malformedAuthorityOrPort = true;
          }
        }
      }
      const matches = uri.match(URI_PARSE);
      if (matches) {
        parsed.scheme = matches[1];
        parsed.userinfo = matches[3];
        parsed.host = matches[4];
        parsed.port = parseInt(matches[5], 10);
        parsed.path = matches[6] || "";
        parsed.query = matches[7];
        parsed.fragment = matches[8];
        if (parsed.scheme !== void 0) {
          if (VALID_SCHEME.test(parsed.scheme)) {
            parsed.scheme = parsed.scheme.toLowerCase();
          } else {
            parsed.error = parsed.error || MALFORMED_SCHEME_ERROR;
            malformedScheme = true;
          }
        }
        malformedPercentEncoding = hasMalformedComponentPercentEncoding(matches);
        if (malformedPercentEncoding) {
          parsed.error = parsed.error || "URI contains malformed percent-encoding.";
        }
        if (isNaN(parsed.port)) {
          parsed.port = matches[5];
        }
        const parseError = getParseError(parsed, matches);
        if (parseError !== void 0) {
          parsed.error = parsed.error || parseError;
          malformedAuthorityOrPort = true;
        }
        if (parsed.host) {
          const ipv4result = isIPv4(parsed.host);
          if (ipv4result === false) {
            const bracketedIPLiteral = isIPLiteral(parsed.host);
            const hasIPLiteralBracket = parsed.host.indexOf("[") !== -1 || parsed.host.indexOf("]") !== -1;
            const ipv6result = normalizeIPv6(parsed.host);
            isIP = ipv6result.isIPV6 || ipv6result.isIPVFuture === true;
            malformedIPLiteral = hasIPLiteralBracket && (!bracketedIPLiteral || ipv6result.error === true);
            parsed.host = isIP ? ipv6result.host : ipv6result.host.toLowerCase();
            if (malformedIPLiteral) {
              parsed.error = parsed.error || MALFORMED_HOST_ERROR;
              malformedAuthorityOrPort = true;
            }
          } else {
            isIP = true;
          }
        }
        if (parsed.scheme === void 0 && parsed.userinfo === void 0 && parsed.host === void 0 && parsed.port === void 0 && parsed.query === void 0 && !parsed.path) {
          parsed.reference = "same-document";
        } else if (parsed.scheme === void 0) {
          parsed.reference = "relative";
        } else if (parsed.fragment === void 0) {
          parsed.reference = "absolute";
        } else {
          parsed.reference = "uri";
        }
        if (options.reference && options.reference !== "suffix" && options.reference !== parsed.reference) {
          parsed.error = parsed.error || "URI is not a " + options.reference + " reference.";
        }
        const schemeHandler = getSchemeHandler(options.scheme || parsed.scheme);
        if (!malformedIPLiteral) {
          malformedHost = canonicalizeHost(parsed, options, schemeHandler, isIP);
        }
        if (uri.indexOf("%") !== -1 && parsed.host !== void 0 && !malformedIPLiteral) {
          let host = isIP ? parsed.host : normalizePercentEncoding(parsed.host, true);
          if (!isIP) {
            host = normalizePercentEncoding(host.toLowerCase());
          }
          parsed.host = isIP || options.scheme !== "null" ? reescapeHostDelimiters(host, isIP) : host;
        }
        if (!schemeHandler || schemeHandler && !schemeHandler.skipNormalize) {
          if (parsed.path) {
            parsed.path = normalizePathEncoding(parsed.path);
          }
          if (parsed.query) {
            parsed.query = normalizeQueryFragmentEncoding(parsed.query);
          }
          if (parsed.fragment) {
            parsed.fragment = normalizeQueryFragmentEncoding(parsed.fragment);
          }
        }
        if (schemeHandler && schemeHandler.parse) {
          schemeHandler.parse(parsed, options);
          if (schemeHandler === SCHEMES.urn && parsed.nid === void 0) {
            malformedSchemeSpecific = true;
          }
        }
      } else {
        parsed.error = parsed.error || "URI can not be parsed.";
      }
      return { parsed, malformedAuthorityOrPort, malformedPercentEncoding, malformedSchemeSpecific, malformedHost, malformedScheme };
    }
    function parse(uri, opts) {
      return parseWithStatus(uri, opts).parsed;
    }
    function normalizeString(uri, opts) {
      return normalizeStringWithStatus(uri, opts).normalized;
    }
    function normalizeStringWithStatus(uri, opts) {
      const { parsed, malformedAuthorityOrPort, malformedPercentEncoding, malformedSchemeSpecific, malformedHost, malformedScheme } = parseWithStatus(uri, opts);
      return {
        normalized: malformedAuthorityOrPort || malformedPercentEncoding || malformedSchemeSpecific || malformedHost || malformedScheme ? uri : serialize(parsed, opts),
        malformedAuthorityOrPort,
        malformedPercentEncoding,
        malformedSchemeSpecific,
        malformedHost,
        malformedScheme
      };
    }
    function normalizeComparableURI(uri, opts) {
      if (typeof uri !== "string" && typeof uri !== "object") {
        return void 0;
      }
      let value;
      try {
        value = typeof uri === "string" ? uri : serialize(uri, opts);
      } catch {
        return void 0;
      }
      const { normalized, malformedAuthorityOrPort, malformedPercentEncoding, malformedSchemeSpecific, malformedHost, malformedScheme } = normalizeStringWithStatus(value, opts);
      return malformedAuthorityOrPort || malformedPercentEncoding || malformedSchemeSpecific || malformedHost || malformedScheme ? void 0 : normalized;
    }
    var fastUri = {
      SCHEMES,
      normalize,
      resolve: resolve3,
      resolveComponent,
      equal,
      serialize,
      parse
    };
    module.exports = fastUri;
    module.exports.default = fastUri;
    module.exports.fastUri = fastUri;
  }
});

// node_modules/ajv/dist/runtime/uri.js
var require_uri = __commonJS({
  "node_modules/ajv/dist/runtime/uri.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var uri = require_fast_uri();
    uri.code = 'require("ajv/dist/runtime/uri").default';
    exports.default = uri;
  }
});

// node_modules/ajv/dist/core.js
var require_core = __commonJS({
  "node_modules/ajv/dist/core.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.CodeGen = exports.Name = exports.nil = exports.stringify = exports.str = exports._ = exports.KeywordCxt = void 0;
    var validate_1 = require_validate();
    Object.defineProperty(exports, "KeywordCxt", { enumerable: true, get: function() {
      return validate_1.KeywordCxt;
    } });
    var codegen_1 = require_codegen();
    Object.defineProperty(exports, "_", { enumerable: true, get: function() {
      return codegen_1._;
    } });
    Object.defineProperty(exports, "str", { enumerable: true, get: function() {
      return codegen_1.str;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
      return codegen_1.stringify;
    } });
    Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
      return codegen_1.nil;
    } });
    Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
      return codegen_1.Name;
    } });
    Object.defineProperty(exports, "CodeGen", { enumerable: true, get: function() {
      return codegen_1.CodeGen;
    } });
    var validation_error_1 = require_validation_error();
    var ref_error_1 = require_ref_error();
    var rules_1 = require_rules();
    var compile_1 = require_compile();
    var codegen_2 = require_codegen();
    var resolve_1 = require_resolve();
    var dataType_1 = require_dataType();
    var util_1 = require_util();
    var $dataRefSchema = require_data();
    var uri_1 = require_uri();
    var defaultRegExp = (str, flags) => new RegExp(str, flags);
    defaultRegExp.code = "new RegExp";
    var META_IGNORE_OPTIONS = ["removeAdditional", "useDefaults", "coerceTypes"];
    var EXT_SCOPE_NAMES = /* @__PURE__ */ new Set([
      "validate",
      "serialize",
      "parse",
      "wrapper",
      "root",
      "schema",
      "keyword",
      "pattern",
      "formats",
      "validate$data",
      "func",
      "obj",
      "Error"
    ]);
    var removedOptions = {
      errorDataPath: "",
      format: "`validateFormats: false` can be used instead.",
      nullable: '"nullable" keyword is supported by default.',
      jsonPointers: "Deprecated jsPropertySyntax can be used instead.",
      extendRefs: "Deprecated ignoreKeywordsWithRef can be used instead.",
      missingRefs: "Pass empty schema with $id that should be ignored to ajv.addSchema.",
      processCode: "Use option `code: {process: (code, schemaEnv: object) => string}`",
      sourceCode: "Use option `code: {source: true}`",
      strictDefaults: "It is default now, see option `strict`.",
      strictKeywords: "It is default now, see option `strict`.",
      uniqueItems: '"uniqueItems" keyword is always validated.',
      unknownFormats: "Disable strict mode or pass `true` to `ajv.addFormat` (or `formats` option).",
      cache: "Map is used as cache, schema object as key.",
      serialize: "Map is used as cache, schema object as key.",
      ajvErrors: "It is default now."
    };
    var deprecatedOptions = {
      ignoreKeywordsWithRef: "",
      jsPropertySyntax: "",
      unicode: '"minLength"/"maxLength" account for unicode characters by default.'
    };
    var MAX_EXPRESSION = 200;
    function requiredOptions(o) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0;
      const s = o.strict;
      const _optz = (_a = o.code) === null || _a === void 0 ? void 0 : _a.optimize;
      const optimize = _optz === true || _optz === void 0 ? 1 : _optz || 0;
      const regExp = (_c = (_b = o.code) === null || _b === void 0 ? void 0 : _b.regExp) !== null && _c !== void 0 ? _c : defaultRegExp;
      const uriResolver = (_d = o.uriResolver) !== null && _d !== void 0 ? _d : uri_1.default;
      return {
        strictSchema: (_f = (_e = o.strictSchema) !== null && _e !== void 0 ? _e : s) !== null && _f !== void 0 ? _f : true,
        strictNumbers: (_h = (_g = o.strictNumbers) !== null && _g !== void 0 ? _g : s) !== null && _h !== void 0 ? _h : true,
        strictTypes: (_k = (_j = o.strictTypes) !== null && _j !== void 0 ? _j : s) !== null && _k !== void 0 ? _k : "log",
        strictTuples: (_m = (_l = o.strictTuples) !== null && _l !== void 0 ? _l : s) !== null && _m !== void 0 ? _m : "log",
        strictRequired: (_p = (_o = o.strictRequired) !== null && _o !== void 0 ? _o : s) !== null && _p !== void 0 ? _p : false,
        code: o.code ? { ...o.code, optimize, regExp } : { optimize, regExp },
        loopRequired: (_q = o.loopRequired) !== null && _q !== void 0 ? _q : MAX_EXPRESSION,
        loopEnum: (_r = o.loopEnum) !== null && _r !== void 0 ? _r : MAX_EXPRESSION,
        meta: (_s = o.meta) !== null && _s !== void 0 ? _s : true,
        messages: (_t = o.messages) !== null && _t !== void 0 ? _t : true,
        inlineRefs: (_u = o.inlineRefs) !== null && _u !== void 0 ? _u : true,
        schemaId: (_v = o.schemaId) !== null && _v !== void 0 ? _v : "$id",
        addUsedSchema: (_w = o.addUsedSchema) !== null && _w !== void 0 ? _w : true,
        validateSchema: (_x = o.validateSchema) !== null && _x !== void 0 ? _x : true,
        validateFormats: (_y = o.validateFormats) !== null && _y !== void 0 ? _y : true,
        unicodeRegExp: (_z = o.unicodeRegExp) !== null && _z !== void 0 ? _z : true,
        int32range: (_0 = o.int32range) !== null && _0 !== void 0 ? _0 : true,
        uriResolver
      };
    }
    var Ajv2 = class {
      constructor(opts = {}) {
        this.schemas = {};
        this.refs = {};
        this.formats = /* @__PURE__ */ Object.create(null);
        this._compilations = /* @__PURE__ */ new Set();
        this._loading = {};
        this._cache = /* @__PURE__ */ new Map();
        opts = this.opts = { ...opts, ...requiredOptions(opts) };
        const { es5, lines } = this.opts.code;
        this.scope = new codegen_2.ValueScope({ scope: {}, prefixes: EXT_SCOPE_NAMES, es5, lines });
        this.logger = getLogger(opts.logger);
        const formatOpt = opts.validateFormats;
        opts.validateFormats = false;
        this.RULES = (0, rules_1.getRules)();
        checkOptions.call(this, removedOptions, opts, "NOT SUPPORTED");
        checkOptions.call(this, deprecatedOptions, opts, "DEPRECATED", "warn");
        this._metaOpts = getMetaSchemaOptions.call(this);
        if (opts.formats)
          addInitialFormats.call(this);
        this._addVocabularies();
        this._addDefaultMetaSchema();
        if (opts.keywords)
          addInitialKeywords.call(this, opts.keywords);
        if (typeof opts.meta == "object")
          this.addMetaSchema(opts.meta);
        addInitialSchemas.call(this);
        opts.validateFormats = formatOpt;
      }
      _addVocabularies() {
        this.addKeyword("$async");
      }
      _addDefaultMetaSchema() {
        const { $data, meta, schemaId } = this.opts;
        let _dataRefSchema = $dataRefSchema;
        if (schemaId === "id") {
          _dataRefSchema = { ...$dataRefSchema };
          _dataRefSchema.id = _dataRefSchema.$id;
          delete _dataRefSchema.$id;
        }
        if (meta && $data)
          this.addMetaSchema(_dataRefSchema, _dataRefSchema[schemaId], false);
      }
      defaultMeta() {
        const { meta, schemaId } = this.opts;
        return this.opts.defaultMeta = typeof meta == "object" ? meta[schemaId] || meta : void 0;
      }
      validate(schemaKeyRef, data) {
        let v;
        if (typeof schemaKeyRef == "string") {
          v = this.getSchema(schemaKeyRef);
          if (!v)
            throw new Error(`no schema with key or ref "${schemaKeyRef}"`);
        } else {
          v = this.compile(schemaKeyRef);
        }
        const valid = v(data);
        if (!("$async" in v))
          this.errors = v.errors;
        return valid;
      }
      compile(schema2, _meta) {
        const sch = this._addSchema(schema2, _meta);
        return sch.validate || this._compileSchemaEnv(sch);
      }
      compileAsync(schema2, meta) {
        if (typeof this.opts.loadSchema != "function") {
          throw new Error("options.loadSchema should be a function");
        }
        const { loadSchema } = this.opts;
        return runCompileAsync.call(this, schema2, meta);
        async function runCompileAsync(_schema, _meta) {
          await loadMetaSchema.call(this, _schema.$schema);
          const sch = this._addSchema(_schema, _meta);
          return sch.validate || _compileAsync.call(this, sch);
        }
        async function loadMetaSchema($ref) {
          if ($ref && !this.getSchema($ref)) {
            await runCompileAsync.call(this, { $ref }, true);
          }
        }
        async function _compileAsync(sch) {
          try {
            return this._compileSchemaEnv(sch);
          } catch (e) {
            if (!(e instanceof ref_error_1.default))
              throw e;
            checkLoaded.call(this, e);
            await loadMissingSchema.call(this, e.missingSchema);
            return _compileAsync.call(this, sch);
          }
        }
        function checkLoaded({ missingSchema: ref, missingRef }) {
          if (this.refs[ref]) {
            throw new Error(`AnySchema ${ref} is loaded but ${missingRef} cannot be resolved`);
          }
        }
        async function loadMissingSchema(ref) {
          const _schema = await _loadSchema.call(this, ref);
          if (!this.refs[ref])
            await loadMetaSchema.call(this, _schema.$schema);
          if (!this.refs[ref])
            this.addSchema(_schema, ref, meta);
        }
        async function _loadSchema(ref) {
          const p = this._loading[ref];
          if (p)
            return p;
          try {
            return await (this._loading[ref] = loadSchema(ref));
          } finally {
            delete this._loading[ref];
          }
        }
      }
      // Adds schema to the instance
      addSchema(schema2, key, _meta, _validateSchema = this.opts.validateSchema) {
        if (Array.isArray(schema2)) {
          for (const sch of schema2)
            this.addSchema(sch, void 0, _meta, _validateSchema);
          return this;
        }
        let id;
        if (typeof schema2 === "object") {
          const { schemaId } = this.opts;
          id = schema2[schemaId];
          if (id !== void 0 && typeof id != "string") {
            throw new Error(`schema ${schemaId} must be string`);
          }
        }
        key = (0, resolve_1.normalizeId)(key || id);
        this._checkUnique(key);
        this.schemas[key] = this._addSchema(schema2, _meta, key, _validateSchema, true);
        return this;
      }
      // Add schema that will be used to validate other schemas
      // options in META_IGNORE_OPTIONS are alway set to false
      addMetaSchema(schema2, key, _validateSchema = this.opts.validateSchema) {
        this.addSchema(schema2, key, true, _validateSchema);
        return this;
      }
      //  Validate schema against its meta-schema
      validateSchema(schema2, throwOrLogError) {
        if (typeof schema2 == "boolean")
          return true;
        let $schema;
        $schema = schema2.$schema;
        if ($schema !== void 0 && typeof $schema != "string") {
          throw new Error("$schema must be a string");
        }
        $schema = $schema || this.opts.defaultMeta || this.defaultMeta();
        if (!$schema) {
          this.logger.warn("meta-schema not available");
          this.errors = null;
          return true;
        }
        const valid = this.validate($schema, schema2);
        if (!valid && throwOrLogError) {
          const message = "schema is invalid: " + this.errorsText();
          if (this.opts.validateSchema === "log")
            this.logger.error(message);
          else
            throw new Error(message);
        }
        return valid;
      }
      // Get compiled schema by `key` or `ref`.
      // (`key` that was passed to `addSchema` or full schema reference - `schema.$id` or resolved id)
      getSchema(keyRef) {
        let sch;
        while (typeof (sch = getSchEnv.call(this, keyRef)) == "string")
          keyRef = sch;
        if (sch === void 0) {
          const { schemaId } = this.opts;
          const root = new compile_1.SchemaEnv({ schema: {}, schemaId });
          sch = compile_1.resolveSchema.call(this, root, keyRef);
          if (!sch)
            return;
          this.refs[keyRef] = sch;
        }
        return sch.validate || this._compileSchemaEnv(sch);
      }
      // Remove cached schema(s).
      // If no parameter is passed all schemas but meta-schemas are removed.
      // If RegExp is passed all schemas with key/id matching pattern but meta-schemas are removed.
      // Even if schema is referenced by other schemas it still can be removed as other schemas have local references.
      removeSchema(schemaKeyRef) {
        if (schemaKeyRef instanceof RegExp) {
          this._removeAllSchemas(this.schemas, schemaKeyRef);
          this._removeAllSchemas(this.refs, schemaKeyRef);
          return this;
        }
        switch (typeof schemaKeyRef) {
          case "undefined":
            this._removeAllSchemas(this.schemas);
            this._removeAllSchemas(this.refs);
            this._cache.clear();
            return this;
          case "string": {
            const sch = getSchEnv.call(this, schemaKeyRef);
            if (typeof sch == "object")
              this._cache.delete(sch.schema);
            delete this.schemas[schemaKeyRef];
            delete this.refs[schemaKeyRef];
            return this;
          }
          case "object": {
            const cacheKey = schemaKeyRef;
            this._cache.delete(cacheKey);
            let id = schemaKeyRef[this.opts.schemaId];
            if (id) {
              id = (0, resolve_1.normalizeId)(id);
              delete this.schemas[id];
              delete this.refs[id];
            }
            return this;
          }
          default:
            throw new Error("ajv.removeSchema: invalid parameter");
        }
      }
      // add "vocabulary" - a collection of keywords
      addVocabulary(definitions) {
        for (const def of definitions)
          this.addKeyword(def);
        return this;
      }
      addKeyword(kwdOrDef, def) {
        let keyword;
        if (typeof kwdOrDef == "string") {
          keyword = kwdOrDef;
          if (typeof def == "object") {
            this.logger.warn("these parameters are deprecated, see docs for addKeyword");
            def.keyword = keyword;
          }
        } else if (typeof kwdOrDef == "object" && def === void 0) {
          def = kwdOrDef;
          keyword = def.keyword;
          if (Array.isArray(keyword) && !keyword.length) {
            throw new Error("addKeywords: keyword must be string or non-empty array");
          }
        } else {
          throw new Error("invalid addKeywords parameters");
        }
        checkKeyword.call(this, keyword, def);
        if (!def) {
          (0, util_1.eachItem)(keyword, (kwd) => addRule.call(this, kwd));
          return this;
        }
        keywordMetaschema.call(this, def);
        const definition = {
          ...def,
          type: (0, dataType_1.getJSONTypes)(def.type),
          schemaType: (0, dataType_1.getJSONTypes)(def.schemaType)
        };
        (0, util_1.eachItem)(keyword, definition.type.length === 0 ? (k) => addRule.call(this, k, definition) : (k) => definition.type.forEach((t) => addRule.call(this, k, definition, t)));
        return this;
      }
      getKeyword(keyword) {
        const rule = this.RULES.all[keyword];
        return typeof rule == "object" ? rule.definition : !!rule;
      }
      // Remove keyword
      removeKeyword(keyword) {
        const { RULES: RULES2 } = this;
        delete RULES2.keywords[keyword];
        delete RULES2.all[keyword];
        for (const group of RULES2.rules) {
          const i = group.rules.findIndex((rule) => rule.keyword === keyword);
          if (i >= 0)
            group.rules.splice(i, 1);
        }
        return this;
      }
      // Add format
      addFormat(name2, format2) {
        if (typeof format2 == "string")
          format2 = new RegExp(format2);
        this.formats[name2] = format2;
        return this;
      }
      errorsText(errors = this.errors, { separator = ", ", dataVar = "data" } = {}) {
        if (!errors || errors.length === 0)
          return "No errors";
        return errors.map((e) => `${dataVar}${e.instancePath} ${e.message}`).reduce((text, msg) => text + separator + msg);
      }
      $dataMetaSchema(metaSchema, keywordsJsonPointers) {
        const rules = this.RULES.all;
        metaSchema = JSON.parse(JSON.stringify(metaSchema));
        for (const jsonPointer of keywordsJsonPointers) {
          const segments = jsonPointer.split("/").slice(1);
          let keywords = metaSchema;
          for (const seg of segments)
            keywords = keywords[seg];
          for (const key in rules) {
            const rule = rules[key];
            if (typeof rule != "object")
              continue;
            const { $data } = rule.definition;
            const schema2 = keywords[key];
            if ($data && schema2)
              keywords[key] = schemaOrData(schema2);
          }
        }
        return metaSchema;
      }
      _removeAllSchemas(schemas, regex) {
        for (const keyRef in schemas) {
          const sch = schemas[keyRef];
          if (!regex || regex.test(keyRef)) {
            if (typeof sch == "string") {
              delete schemas[keyRef];
            } else if (sch && !sch.meta) {
              this._cache.delete(sch.schema);
              delete schemas[keyRef];
            }
          }
        }
      }
      _addSchema(schema2, meta, baseId, validateSchema = this.opts.validateSchema, addSchema = this.opts.addUsedSchema) {
        let id;
        const { schemaId } = this.opts;
        if (typeof schema2 == "object") {
          id = schema2[schemaId];
        } else {
          if (this.opts.jtd)
            throw new Error("schema must be object");
          else if (typeof schema2 != "boolean")
            throw new Error("schema must be object or boolean");
        }
        let sch = this._cache.get(schema2);
        if (sch !== void 0)
          return sch;
        baseId = (0, resolve_1.normalizeId)(id || baseId);
        const localRefs = resolve_1.getSchemaRefs.call(this, schema2, baseId);
        sch = new compile_1.SchemaEnv({ schema: schema2, schemaId, meta, baseId, localRefs });
        this._cache.set(sch.schema, sch);
        if (addSchema && !baseId.startsWith("#")) {
          if (baseId)
            this._checkUnique(baseId);
          this.refs[baseId] = sch;
        }
        if (validateSchema)
          this.validateSchema(schema2, true);
        return sch;
      }
      _checkUnique(id) {
        if (this.schemas[id] || this.refs[id]) {
          throw new Error(`schema with key or id "${id}" already exists`);
        }
      }
      _compileSchemaEnv(sch) {
        if (sch.meta)
          this._compileMetaSchema(sch);
        else
          compile_1.compileSchema.call(this, sch);
        if (!sch.validate)
          throw new Error("ajv implementation error");
        return sch.validate;
      }
      _compileMetaSchema(sch) {
        const currentOpts = this.opts;
        this.opts = this._metaOpts;
        try {
          compile_1.compileSchema.call(this, sch);
        } finally {
          this.opts = currentOpts;
        }
      }
    };
    Ajv2.ValidationError = validation_error_1.default;
    Ajv2.MissingRefError = ref_error_1.default;
    exports.default = Ajv2;
    function checkOptions(checkOpts, options, msg, log = "error") {
      for (const key in checkOpts) {
        const opt = key;
        if (opt in options)
          this.logger[log](`${msg}: option ${key}. ${checkOpts[opt]}`);
      }
    }
    function getSchEnv(keyRef) {
      keyRef = (0, resolve_1.normalizeId)(keyRef);
      return this.schemas[keyRef] || this.refs[keyRef];
    }
    function addInitialSchemas() {
      const optsSchemas = this.opts.schemas;
      if (!optsSchemas)
        return;
      if (Array.isArray(optsSchemas))
        this.addSchema(optsSchemas);
      else
        for (const key in optsSchemas)
          this.addSchema(optsSchemas[key], key);
    }
    function addInitialFormats() {
      for (const name2 in this.opts.formats) {
        const format2 = this.opts.formats[name2];
        if (format2)
          this.addFormat(name2, format2);
      }
    }
    function addInitialKeywords(defs) {
      if (Array.isArray(defs)) {
        this.addVocabulary(defs);
        return;
      }
      this.logger.warn("keywords option as map is deprecated, pass array");
      for (const keyword in defs) {
        const def = defs[keyword];
        if (!def.keyword)
          def.keyword = keyword;
        this.addKeyword(def);
      }
    }
    function getMetaSchemaOptions() {
      const metaOpts = { ...this.opts };
      for (const opt of META_IGNORE_OPTIONS)
        delete metaOpts[opt];
      return metaOpts;
    }
    var noLogs = { log() {
    }, warn() {
    }, error() {
    } };
    function getLogger(logger) {
      if (logger === false)
        return noLogs;
      if (logger === void 0)
        return console;
      if (logger.log && logger.warn && logger.error)
        return logger;
      throw new Error("logger must implement log, warn and error methods");
    }
    var KEYWORD_NAME = /^[a-z_$][a-z0-9_$:-]*$/i;
    function checkKeyword(keyword, def) {
      const { RULES: RULES2 } = this;
      (0, util_1.eachItem)(keyword, (kwd) => {
        if (RULES2.keywords[kwd])
          throw new Error(`Keyword ${kwd} is already defined`);
        if (!KEYWORD_NAME.test(kwd))
          throw new Error(`Keyword ${kwd} has invalid name`);
      });
      if (!def)
        return;
      if (def.$data && !("code" in def || "validate" in def)) {
        throw new Error('$data keyword must have "code" or "validate" function');
      }
    }
    function addRule(keyword, definition, dataType) {
      var _a;
      const post = definition === null || definition === void 0 ? void 0 : definition.post;
      if (dataType && post)
        throw new Error('keyword with "post" flag cannot have "type"');
      const { RULES: RULES2 } = this;
      let ruleGroup = post ? RULES2.post : RULES2.rules.find(({ type: t }) => t === dataType);
      if (!ruleGroup) {
        ruleGroup = { type: dataType, rules: [] };
        RULES2.rules.push(ruleGroup);
      }
      RULES2.keywords[keyword] = true;
      if (!definition)
        return;
      const rule = {
        keyword,
        definition: {
          ...definition,
          type: (0, dataType_1.getJSONTypes)(definition.type),
          schemaType: (0, dataType_1.getJSONTypes)(definition.schemaType)
        }
      };
      if (definition.before)
        addBeforeRule.call(this, ruleGroup, rule, definition.before);
      else
        ruleGroup.rules.push(rule);
      RULES2.all[keyword] = rule;
      (_a = definition.implements) === null || _a === void 0 ? void 0 : _a.forEach((kwd) => this.addKeyword(kwd));
    }
    function addBeforeRule(ruleGroup, rule, before) {
      const i = ruleGroup.rules.findIndex((_rule) => _rule.keyword === before);
      if (i >= 0) {
        ruleGroup.rules.splice(i, 0, rule);
      } else {
        ruleGroup.rules.push(rule);
        this.logger.warn(`rule ${before} is not defined`);
      }
    }
    function keywordMetaschema(def) {
      let { metaSchema } = def;
      if (metaSchema === void 0)
        return;
      if (def.$data && this.opts.$data)
        metaSchema = schemaOrData(metaSchema);
      def.validateSchema = this.compile(metaSchema, true);
    }
    var $dataRef = {
      $ref: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#"
    };
    function schemaOrData(schema2) {
      return { anyOf: [schema2, $dataRef] };
    }
  }
});

// node_modules/ajv/dist/vocabularies/core/id.js
var require_id = __commonJS({
  "node_modules/ajv/dist/vocabularies/core/id.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var def = {
      keyword: "id",
      code() {
        throw new Error('NOT SUPPORTED: keyword "id", use "$id" for schema ID');
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/core/ref.js
var require_ref = __commonJS({
  "node_modules/ajv/dist/vocabularies/core/ref.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.callRef = exports.getValidate = void 0;
    var ref_error_1 = require_ref_error();
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var compile_1 = require_compile();
    var util_1 = require_util();
    var def = {
      keyword: "$ref",
      schemaType: "string",
      code(cxt) {
        const { gen, schema: $ref, it } = cxt;
        const { baseId, schemaEnv: env, validateName, opts, self } = it;
        const { root } = env;
        if (($ref === "#" || $ref === "#/") && baseId === root.baseId)
          return callRootRef();
        const schOrEnv = compile_1.resolveRef.call(self, root, baseId, $ref);
        if (schOrEnv === void 0)
          throw new ref_error_1.default(it.opts.uriResolver, baseId, $ref);
        if (schOrEnv instanceof compile_1.SchemaEnv)
          return callValidate(schOrEnv);
        return inlineRefSchema(schOrEnv);
        function callRootRef() {
          if (env === root)
            return callRef(cxt, validateName, env, env.$async);
          const rootName = gen.scopeValue("root", { ref: root });
          return callRef(cxt, (0, codegen_1._)`${rootName}.validate`, root, root.$async);
        }
        function callValidate(sch) {
          const v = getValidate(cxt, sch);
          callRef(cxt, v, sch, sch.$async);
        }
        function inlineRefSchema(sch) {
          const schName = gen.scopeValue("schema", opts.code.source === true ? { ref: sch, code: (0, codegen_1.stringify)(sch) } : { ref: sch });
          const valid = gen.name("valid");
          const schCxt = cxt.subschema({
            schema: sch,
            dataTypes: [],
            schemaPath: codegen_1.nil,
            topSchemaRef: schName,
            errSchemaPath: $ref
          }, valid);
          cxt.mergeEvaluated(schCxt);
          cxt.ok(valid);
        }
      }
    };
    function getValidate(cxt, sch) {
      const { gen } = cxt;
      return sch.validate ? gen.scopeValue("validate", { ref: sch.validate }) : (0, codegen_1._)`${gen.scopeValue("wrapper", { ref: sch })}.validate`;
    }
    exports.getValidate = getValidate;
    function callRef(cxt, v, sch, $async) {
      const { gen, it } = cxt;
      const { allErrors, schemaEnv: env, opts } = it;
      const passCxt = opts.passContext ? names_1.default.this : codegen_1.nil;
      if ($async)
        callAsyncRef();
      else
        callSyncRef();
      function callAsyncRef() {
        if (!env.$async)
          throw new Error("async schema referenced by sync schema");
        const valid = gen.let("valid");
        gen.try(() => {
          gen.code((0, codegen_1._)`await ${(0, code_1.callValidateCode)(cxt, v, passCxt)}`);
          addEvaluatedFrom(v);
          if (!allErrors)
            gen.assign(valid, true);
        }, (e) => {
          gen.if((0, codegen_1._)`!(${e} instanceof ${it.ValidationError})`, () => gen.throw(e));
          addErrorsFrom(e);
          if (!allErrors)
            gen.assign(valid, false);
        });
        cxt.ok(valid);
      }
      function callSyncRef() {
        cxt.result((0, code_1.callValidateCode)(cxt, v, passCxt), () => addEvaluatedFrom(v), () => addErrorsFrom(v));
      }
      function addErrorsFrom(source) {
        const errs = (0, codegen_1._)`${source}.errors`;
        gen.assign(names_1.default.vErrors, (0, codegen_1._)`${names_1.default.vErrors} === null ? ${errs} : ${names_1.default.vErrors}.concat(${errs})`);
        gen.assign(names_1.default.errors, (0, codegen_1._)`${names_1.default.vErrors}.length`);
      }
      function addEvaluatedFrom(source) {
        var _a;
        if (!it.opts.unevaluated)
          return;
        const schEvaluated = (_a = sch === null || sch === void 0 ? void 0 : sch.validate) === null || _a === void 0 ? void 0 : _a.evaluated;
        if (it.props !== true) {
          if (schEvaluated && !schEvaluated.dynamicProps) {
            if (schEvaluated.props !== void 0) {
              it.props = util_1.mergeEvaluated.props(gen, schEvaluated.props, it.props);
            }
          } else {
            const props = gen.var("props", (0, codegen_1._)`${source}.evaluated.props`);
            it.props = util_1.mergeEvaluated.props(gen, props, it.props, codegen_1.Name);
          }
        }
        if (it.items !== true) {
          if (schEvaluated && !schEvaluated.dynamicItems) {
            if (schEvaluated.items !== void 0) {
              it.items = util_1.mergeEvaluated.items(gen, schEvaluated.items, it.items);
            }
          } else {
            const items = gen.var("items", (0, codegen_1._)`${source}.evaluated.items`);
            it.items = util_1.mergeEvaluated.items(gen, items, it.items, codegen_1.Name);
          }
        }
      }
    }
    exports.callRef = callRef;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/core/index.js
var require_core2 = __commonJS({
  "node_modules/ajv/dist/vocabularies/core/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var id_1 = require_id();
    var ref_1 = require_ref();
    var core = [
      "$schema",
      "$id",
      "$defs",
      "$vocabulary",
      { keyword: "$comment" },
      "definitions",
      id_1.default,
      ref_1.default
    ];
    exports.default = core;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitNumber.js
var require_limitNumber = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitNumber.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var ops = codegen_1.operators;
    var KWDs = {
      maximum: { okStr: "<=", ok: ops.LTE, fail: ops.GT },
      minimum: { okStr: ">=", ok: ops.GTE, fail: ops.LT },
      exclusiveMaximum: { okStr: "<", ok: ops.LT, fail: ops.GTE },
      exclusiveMinimum: { okStr: ">", ok: ops.GT, fail: ops.LTE }
    };
    var error = {
      message: ({ keyword, schemaCode }) => (0, codegen_1.str)`must be ${KWDs[keyword].okStr} ${schemaCode}`,
      params: ({ keyword, schemaCode }) => (0, codegen_1._)`{comparison: ${KWDs[keyword].okStr}, limit: ${schemaCode}}`
    };
    var def = {
      keyword: Object.keys(KWDs),
      type: "number",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        cxt.fail$data((0, codegen_1._)`${data} ${KWDs[keyword].fail} ${schemaCode} || isNaN(${data})`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/multipleOf.js
var require_multipleOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/multipleOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must be multiple of ${schemaCode}`,
      params: ({ schemaCode }) => (0, codegen_1._)`{multipleOf: ${schemaCode}}`
    };
    var def = {
      keyword: "multipleOf",
      type: "number",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, schemaCode, it } = cxt;
        const prec = it.opts.multipleOfPrecision;
        const res = gen.let("res");
        const invalid = prec ? (0, codegen_1._)`Math.abs(Math.round(${res}) - ${res}) > 1e-${prec}` : (0, codegen_1._)`${res} !== parseInt(${res})`;
        cxt.fail$data((0, codegen_1._)`(${schemaCode} === 0 || (${res} = ${data}/${schemaCode}, ${invalid}))`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/runtime/ucs2length.js
var require_ucs2length = __commonJS({
  "node_modules/ajv/dist/runtime/ucs2length.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function ucs2length(str) {
      const len = str.length;
      let length = 0;
      let pos = 0;
      let value;
      while (pos < len) {
        length++;
        value = str.charCodeAt(pos++);
        if (value >= 55296 && value <= 56319 && pos < len) {
          value = str.charCodeAt(pos);
          if ((value & 64512) === 56320)
            pos++;
        }
      }
      return length;
    }
    exports.default = ucs2length;
    ucs2length.code = 'require("ajv/dist/runtime/ucs2length").default';
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitLength.js
var require_limitLength = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitLength.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var ucs2length_1 = require_ucs2length();
    var error = {
      message({ keyword, schemaCode }) {
        const comp = keyword === "maxLength" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} characters`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    };
    var def = {
      keyword: ["maxLength", "minLength"],
      type: "string",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode, it } = cxt;
        const op = keyword === "maxLength" ? codegen_1.operators.GT : codegen_1.operators.LT;
        const len = it.opts.unicode === false ? (0, codegen_1._)`${data}.length` : (0, codegen_1._)`${(0, util_1.useFunc)(cxt.gen, ucs2length_1.default)}(${data})`;
        cxt.fail$data((0, codegen_1._)`${len} ${op} ${schemaCode}`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/pattern.js
var require_pattern = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/pattern.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var util_1 = require_util();
    var codegen_1 = require_codegen();
    var error = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must match pattern "${schemaCode}"`,
      params: ({ schemaCode }) => (0, codegen_1._)`{pattern: ${schemaCode}}`
    };
    var def = {
      keyword: "pattern",
      type: "string",
      schemaType: "string",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schema: schema2, schemaCode, it } = cxt;
        const u = it.opts.unicodeRegExp ? "u" : "";
        if ($data) {
          const { regExp } = it.opts.code;
          const regExpCode = regExp.code === "new RegExp" ? (0, codegen_1._)`new RegExp` : (0, util_1.useFunc)(gen, regExp);
          const valid = gen.let("valid");
          gen.try(() => gen.assign(valid, (0, codegen_1._)`${regExpCode}(${schemaCode}, ${u}).test(${data})`), () => gen.assign(valid, false));
          cxt.fail$data((0, codegen_1._)`!${valid}`);
        } else {
          const regExp = (0, code_1.usePattern)(cxt, schema2);
          cxt.fail$data((0, codegen_1._)`!${regExp}.test(${data})`);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitProperties.js
var require_limitProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message({ keyword, schemaCode }) {
        const comp = keyword === "maxProperties" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} properties`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    };
    var def = {
      keyword: ["maxProperties", "minProperties"],
      type: "object",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        const op = keyword === "maxProperties" ? codegen_1.operators.GT : codegen_1.operators.LT;
        cxt.fail$data((0, codegen_1._)`Object.keys(${data}).length ${op} ${schemaCode}`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/required.js
var require_required = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/required.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { missingProperty } }) => (0, codegen_1.str)`must have required property '${missingProperty}'`,
      params: ({ params: { missingProperty } }) => (0, codegen_1._)`{missingProperty: ${missingProperty}}`
    };
    var def = {
      keyword: "required",
      type: "object",
      schemaType: "array",
      $data: true,
      error,
      code(cxt) {
        const { gen, schema: schema2, schemaCode, data, $data, it } = cxt;
        const { opts } = it;
        if (!$data && schema2.length === 0)
          return;
        const useLoop = schema2.length >= opts.loopRequired;
        if (it.allErrors)
          allErrorsMode();
        else
          exitOnErrorMode();
        if (opts.strictRequired) {
          const props = cxt.parentSchema.properties;
          const { definedProperties } = cxt.it;
          for (const requiredKey of schema2) {
            if ((props === null || props === void 0 ? void 0 : props[requiredKey]) === void 0 && !definedProperties.has(requiredKey)) {
              const schemaPath = it.schemaEnv.baseId + it.errSchemaPath;
              const msg = `required property "${requiredKey}" is not defined at "${schemaPath}" (strictRequired)`;
              (0, util_1.checkStrictMode)(it, msg, it.opts.strictRequired);
            }
          }
        }
        function allErrorsMode() {
          if (useLoop || $data) {
            cxt.block$data(codegen_1.nil, loopAllRequired);
          } else {
            for (const prop of schema2) {
              (0, code_1.checkReportMissingProp)(cxt, prop);
            }
          }
        }
        function exitOnErrorMode() {
          const missing = gen.let("missing");
          if (useLoop || $data) {
            const valid = gen.let("valid", true);
            cxt.block$data(valid, () => loopUntilMissing(missing, valid));
            cxt.ok(valid);
          } else {
            gen.if((0, code_1.checkMissingProp)(cxt, schema2, missing));
            (0, code_1.reportMissingProp)(cxt, missing);
            gen.else();
          }
        }
        function loopAllRequired() {
          gen.forOf("prop", schemaCode, (prop) => {
            cxt.setParams({ missingProperty: prop });
            gen.if((0, code_1.noPropertyInData)(gen, data, prop, opts.ownProperties), () => cxt.error());
          });
        }
        function loopUntilMissing(missing, valid) {
          cxt.setParams({ missingProperty: missing });
          gen.forOf(missing, schemaCode, () => {
            gen.assign(valid, (0, code_1.propertyInData)(gen, data, missing, opts.ownProperties));
            gen.if((0, codegen_1.not)(valid), () => {
              cxt.error();
              gen.break();
            });
          }, codegen_1.nil);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitItems.js
var require_limitItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message({ keyword, schemaCode }) {
        const comp = keyword === "maxItems" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} items`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    };
    var def = {
      keyword: ["maxItems", "minItems"],
      type: "array",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        const op = keyword === "maxItems" ? codegen_1.operators.GT : codegen_1.operators.LT;
        cxt.fail$data((0, codegen_1._)`${data}.length ${op} ${schemaCode}`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/runtime/equal.js
var require_equal = __commonJS({
  "node_modules/ajv/dist/runtime/equal.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var equal = require_fast_deep_equal();
    equal.code = 'require("ajv/dist/runtime/equal").default';
    exports.default = equal;
  }
});

// node_modules/ajv/dist/vocabularies/validation/uniqueItems.js
var require_uniqueItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/uniqueItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dataType_1 = require_dataType();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var equal_1 = require_equal();
    var error = {
      message: ({ params: { i, j } }) => (0, codegen_1.str)`must NOT have duplicate items (items ## ${j} and ${i} are identical)`,
      params: ({ params: { i, j } }) => (0, codegen_1._)`{i: ${i}, j: ${j}}`
    };
    var def = {
      keyword: "uniqueItems",
      type: "array",
      schemaType: "boolean",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schema: schema2, parentSchema, schemaCode, it } = cxt;
        if (!$data && !schema2)
          return;
        const valid = gen.let("valid");
        const itemTypes = parentSchema.items ? (0, dataType_1.getSchemaTypes)(parentSchema.items) : [];
        cxt.block$data(valid, validateUniqueItems, (0, codegen_1._)`${schemaCode} === false`);
        cxt.ok(valid);
        function validateUniqueItems() {
          const i = gen.let("i", (0, codegen_1._)`${data}.length`);
          const j = gen.let("j");
          cxt.setParams({ i, j });
          gen.assign(valid, true);
          gen.if((0, codegen_1._)`${i} > 1`, () => (canOptimize() ? loopN : loopN2)(i, j));
        }
        function canOptimize() {
          return itemTypes.length > 0 && !itemTypes.some((t) => t === "object" || t === "array");
        }
        function loopN(i, j) {
          const item = gen.name("item");
          const wrongType = (0, dataType_1.checkDataTypes)(itemTypes, item, it.opts.strictNumbers, dataType_1.DataType.Wrong);
          const indices = gen.const("indices", (0, codegen_1._)`{}`);
          gen.for((0, codegen_1._)`;${i}--;`, () => {
            gen.let(item, (0, codegen_1._)`${data}[${i}]`);
            gen.if(wrongType, (0, codegen_1._)`continue`);
            if (itemTypes.length > 1)
              gen.if((0, codegen_1._)`typeof ${item} == "string"`, (0, codegen_1._)`${item} += "_"`);
            gen.if((0, codegen_1._)`typeof ${indices}[${item}] == "number"`, () => {
              gen.assign(j, (0, codegen_1._)`${indices}[${item}]`);
              cxt.error();
              gen.assign(valid, false).break();
            }).code((0, codegen_1._)`${indices}[${item}] = ${i}`);
          });
        }
        function loopN2(i, j) {
          const eql = (0, util_1.useFunc)(gen, equal_1.default);
          const outer = gen.name("outer");
          gen.label(outer).for((0, codegen_1._)`;${i}--;`, () => gen.for((0, codegen_1._)`${j} = ${i}; ${j}--;`, () => gen.if((0, codegen_1._)`${eql}(${data}[${i}], ${data}[${j}])`, () => {
            cxt.error();
            gen.assign(valid, false).break(outer);
          })));
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/const.js
var require_const = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/const.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var equal_1 = require_equal();
    var error = {
      message: "must be equal to constant",
      params: ({ schemaCode }) => (0, codegen_1._)`{allowedValue: ${schemaCode}}`
    };
    var def = {
      keyword: "const",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schemaCode, schema: schema2 } = cxt;
        if ($data || schema2 && typeof schema2 == "object") {
          cxt.fail$data((0, codegen_1._)`!${(0, util_1.useFunc)(gen, equal_1.default)}(${data}, ${schemaCode})`);
        } else {
          cxt.fail((0, codegen_1._)`${schema2} !== ${data}`);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/enum.js
var require_enum = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/enum.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var equal_1 = require_equal();
    var error = {
      message: "must be equal to one of the allowed values",
      params: ({ schemaCode }) => (0, codegen_1._)`{allowedValues: ${schemaCode}}`
    };
    var def = {
      keyword: "enum",
      schemaType: "array",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schema: schema2, schemaCode, it } = cxt;
        if (!$data && schema2.length === 0)
          throw new Error("enum must have non-empty array");
        const useLoop = schema2.length >= it.opts.loopEnum;
        let eql;
        const getEql = () => eql !== null && eql !== void 0 ? eql : eql = (0, util_1.useFunc)(gen, equal_1.default);
        let valid;
        if (useLoop || $data) {
          valid = gen.let("valid");
          cxt.block$data(valid, loopEnum);
        } else {
          if (!Array.isArray(schema2))
            throw new Error("ajv implementation error");
          const vSchema = gen.const("vSchema", schemaCode);
          valid = (0, codegen_1.or)(...schema2.map((_x, i) => equalCode(vSchema, i)));
        }
        cxt.pass(valid);
        function loopEnum() {
          gen.assign(valid, false);
          gen.forOf("v", schemaCode, (v) => gen.if((0, codegen_1._)`${getEql()}(${data}, ${v})`, () => gen.assign(valid, true).break()));
        }
        function equalCode(vSchema, i) {
          const sch = schema2[i];
          return typeof sch === "object" && sch !== null ? (0, codegen_1._)`${getEql()}(${data}, ${vSchema}[${i}])` : (0, codegen_1._)`${data} === ${sch}`;
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/index.js
var require_validation = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var limitNumber_1 = require_limitNumber();
    var multipleOf_1 = require_multipleOf();
    var limitLength_1 = require_limitLength();
    var pattern_1 = require_pattern();
    var limitProperties_1 = require_limitProperties();
    var required_1 = require_required();
    var limitItems_1 = require_limitItems();
    var uniqueItems_1 = require_uniqueItems();
    var const_1 = require_const();
    var enum_1 = require_enum();
    var validation = [
      // number
      limitNumber_1.default,
      multipleOf_1.default,
      // string
      limitLength_1.default,
      pattern_1.default,
      // object
      limitProperties_1.default,
      required_1.default,
      // array
      limitItems_1.default,
      uniqueItems_1.default,
      // any
      { keyword: "type", schemaType: ["string", "array"] },
      { keyword: "nullable", schemaType: "boolean" },
      const_1.default,
      enum_1.default
    ];
    exports.default = validation;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/additionalItems.js
var require_additionalItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/additionalItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateAdditionalItems = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
      params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
    };
    var def = {
      keyword: "additionalItems",
      type: "array",
      schemaType: ["boolean", "object"],
      before: "uniqueItems",
      error,
      code(cxt) {
        const { parentSchema, it } = cxt;
        const { items } = parentSchema;
        if (!Array.isArray(items)) {
          (0, util_1.checkStrictMode)(it, '"additionalItems" is ignored when "items" is not an array of schemas');
          return;
        }
        validateAdditionalItems(cxt, items);
      }
    };
    function validateAdditionalItems(cxt, items) {
      const { gen, schema: schema2, data, keyword, it } = cxt;
      it.items = true;
      const len = gen.const("len", (0, codegen_1._)`${data}.length`);
      if (schema2 === false) {
        cxt.setParams({ len: items.length });
        cxt.pass((0, codegen_1._)`${len} <= ${items.length}`);
      } else if (typeof schema2 == "object" && !(0, util_1.alwaysValidSchema)(it, schema2)) {
        const valid = gen.var("valid", (0, codegen_1._)`${len} <= ${items.length}`);
        gen.if((0, codegen_1.not)(valid), () => validateItems(valid));
        cxt.ok(valid);
      }
      function validateItems(valid) {
        gen.forRange("i", items.length, len, (i) => {
          cxt.subschema({ keyword, dataProp: i, dataPropType: util_1.Type.Num }, valid);
          if (!it.allErrors)
            gen.if((0, codegen_1.not)(valid), () => gen.break());
        });
      }
    }
    exports.validateAdditionalItems = validateAdditionalItems;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/items.js
var require_items = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/items.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateTuple = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var code_1 = require_code2();
    var def = {
      keyword: "items",
      type: "array",
      schemaType: ["object", "array", "boolean"],
      before: "uniqueItems",
      code(cxt) {
        const { schema: schema2, it } = cxt;
        if (Array.isArray(schema2))
          return validateTuple(cxt, "additionalItems", schema2);
        it.items = true;
        if ((0, util_1.alwaysValidSchema)(it, schema2))
          return;
        cxt.ok((0, code_1.validateArray)(cxt));
      }
    };
    function validateTuple(cxt, extraItems, schArr = cxt.schema) {
      const { gen, parentSchema, data, keyword, it } = cxt;
      checkStrictTuple(parentSchema);
      if (it.opts.unevaluated && schArr.length && it.items !== true) {
        it.items = util_1.mergeEvaluated.items(gen, schArr.length, it.items);
      }
      const valid = gen.name("valid");
      const len = gen.const("len", (0, codegen_1._)`${data}.length`);
      schArr.forEach((sch, i) => {
        if ((0, util_1.alwaysValidSchema)(it, sch))
          return;
        gen.if((0, codegen_1._)`${len} > ${i}`, () => cxt.subschema({
          keyword,
          schemaProp: i,
          dataProp: i
        }, valid));
        cxt.ok(valid);
      });
      function checkStrictTuple(sch) {
        const { opts, errSchemaPath } = it;
        const l = schArr.length;
        const fullTuple = l === sch.minItems && (l === sch.maxItems || sch[extraItems] === false);
        if (opts.strictTuples && !fullTuple) {
          const msg = `"${keyword}" is ${l}-tuple, but minItems or maxItems/${extraItems} are not specified or different at path "${errSchemaPath}"`;
          (0, util_1.checkStrictMode)(it, msg, opts.strictTuples);
        }
      }
    }
    exports.validateTuple = validateTuple;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/prefixItems.js
var require_prefixItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/prefixItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var items_1 = require_items();
    var def = {
      keyword: "prefixItems",
      type: "array",
      schemaType: ["array"],
      before: "uniqueItems",
      code: (cxt) => (0, items_1.validateTuple)(cxt, "items")
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/items2020.js
var require_items2020 = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/items2020.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var code_1 = require_code2();
    var additionalItems_1 = require_additionalItems();
    var error = {
      message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
      params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
    };
    var def = {
      keyword: "items",
      type: "array",
      schemaType: ["object", "boolean"],
      before: "uniqueItems",
      error,
      code(cxt) {
        const { schema: schema2, parentSchema, it } = cxt;
        const { prefixItems } = parentSchema;
        it.items = true;
        if ((0, util_1.alwaysValidSchema)(it, schema2))
          return;
        if (prefixItems)
          (0, additionalItems_1.validateAdditionalItems)(cxt, prefixItems);
        else
          cxt.ok((0, code_1.validateArray)(cxt));
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/contains.js
var require_contains = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/contains.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { min, max } }) => max === void 0 ? (0, codegen_1.str)`must contain at least ${min} valid item(s)` : (0, codegen_1.str)`must contain at least ${min} and no more than ${max} valid item(s)`,
      params: ({ params: { min, max } }) => max === void 0 ? (0, codegen_1._)`{minContains: ${min}}` : (0, codegen_1._)`{minContains: ${min}, maxContains: ${max}}`
    };
    var def = {
      keyword: "contains",
      type: "array",
      schemaType: ["object", "boolean"],
      before: "uniqueItems",
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema: schema2, parentSchema, data, it } = cxt;
        let min;
        let max;
        const { minContains, maxContains } = parentSchema;
        if (it.opts.next) {
          min = minContains === void 0 ? 1 : minContains;
          max = maxContains;
        } else {
          min = 1;
        }
        const len = gen.const("len", (0, codegen_1._)`${data}.length`);
        cxt.setParams({ min, max });
        if (max === void 0 && min === 0) {
          (0, util_1.checkStrictMode)(it, `"minContains" == 0 without "maxContains": "contains" keyword ignored`);
          return;
        }
        if (max !== void 0 && min > max) {
          (0, util_1.checkStrictMode)(it, `"minContains" > "maxContains" is always invalid`);
          cxt.fail();
          return;
        }
        if ((0, util_1.alwaysValidSchema)(it, schema2)) {
          let cond = (0, codegen_1._)`${len} >= ${min}`;
          if (max !== void 0)
            cond = (0, codegen_1._)`${cond} && ${len} <= ${max}`;
          cxt.pass(cond);
          return;
        }
        it.items = true;
        const valid = gen.name("valid");
        if (max === void 0 && min === 1) {
          validateItems(valid, () => gen.if(valid, () => gen.break()));
        } else if (min === 0) {
          gen.let(valid, true);
          if (max !== void 0)
            gen.if((0, codegen_1._)`${data}.length > 0`, validateItemsWithCount);
        } else {
          gen.let(valid, false);
          validateItemsWithCount();
        }
        cxt.result(valid, () => cxt.reset());
        function validateItemsWithCount() {
          const schValid = gen.name("_valid");
          const count = gen.let("count", 0);
          validateItems(schValid, () => gen.if(schValid, () => checkLimits(count)));
        }
        function validateItems(_valid, block) {
          gen.forRange("i", 0, len, (i) => {
            cxt.subschema({
              keyword: "contains",
              dataProp: i,
              dataPropType: util_1.Type.Num,
              compositeRule: true
            }, _valid);
            block();
          });
        }
        function checkLimits(count) {
          gen.code((0, codegen_1._)`${count}++`);
          if (max === void 0) {
            gen.if((0, codegen_1._)`${count} >= ${min}`, () => gen.assign(valid, true).break());
          } else {
            gen.if((0, codegen_1._)`${count} > ${max}`, () => gen.assign(valid, false).break());
            if (min === 1)
              gen.assign(valid, true);
            else
              gen.if((0, codegen_1._)`${count} >= ${min}`, () => gen.assign(valid, true));
          }
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/dependencies.js
var require_dependencies = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/dependencies.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateSchemaDeps = exports.validatePropertyDeps = exports.error = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var code_1 = require_code2();
    exports.error = {
      message: ({ params: { property, depsCount, deps } }) => {
        const property_ies = depsCount === 1 ? "property" : "properties";
        return (0, codegen_1.str)`must have ${property_ies} ${deps} when property ${property} is present`;
      },
      params: ({ params: { property, depsCount, deps, missingProperty } }) => (0, codegen_1._)`{property: ${property},
    missingProperty: ${missingProperty},
    depsCount: ${depsCount},
    deps: ${deps}}`
      // TODO change to reference
    };
    var def = {
      keyword: "dependencies",
      type: "object",
      schemaType: "object",
      error: exports.error,
      code(cxt) {
        const [propDeps, schDeps] = splitDependencies(cxt);
        validatePropertyDeps(cxt, propDeps);
        validateSchemaDeps(cxt, schDeps);
      }
    };
    function splitDependencies({ schema: schema2 }) {
      const propertyDeps = {};
      const schemaDeps = {};
      for (const key in schema2) {
        if (key === "__proto__")
          continue;
        const deps = Array.isArray(schema2[key]) ? propertyDeps : schemaDeps;
        deps[key] = schema2[key];
      }
      return [propertyDeps, schemaDeps];
    }
    function validatePropertyDeps(cxt, propertyDeps = cxt.schema) {
      const { gen, data, it } = cxt;
      if (Object.keys(propertyDeps).length === 0)
        return;
      const missing = gen.let("missing");
      for (const prop in propertyDeps) {
        const deps = propertyDeps[prop];
        if (deps.length === 0)
          continue;
        const hasProperty = (0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties);
        cxt.setParams({
          property: prop,
          depsCount: deps.length,
          deps: deps.join(", ")
        });
        if (it.allErrors) {
          gen.if(hasProperty, () => {
            for (const depProp of deps) {
              (0, code_1.checkReportMissingProp)(cxt, depProp);
            }
          });
        } else {
          gen.if((0, codegen_1._)`${hasProperty} && (${(0, code_1.checkMissingProp)(cxt, deps, missing)})`);
          (0, code_1.reportMissingProp)(cxt, missing);
          gen.else();
        }
      }
    }
    exports.validatePropertyDeps = validatePropertyDeps;
    function validateSchemaDeps(cxt, schemaDeps = cxt.schema) {
      const { gen, data, keyword, it } = cxt;
      const valid = gen.name("valid");
      for (const prop in schemaDeps) {
        if ((0, util_1.alwaysValidSchema)(it, schemaDeps[prop]))
          continue;
        gen.if(
          (0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties),
          () => {
            const schCxt = cxt.subschema({ keyword, schemaProp: prop }, valid);
            cxt.mergeValidEvaluated(schCxt, valid);
          },
          () => gen.var(valid, true)
          // TODO var
        );
        cxt.ok(valid);
      }
    }
    exports.validateSchemaDeps = validateSchemaDeps;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/propertyNames.js
var require_propertyNames = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/propertyNames.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: "property name must be valid",
      params: ({ params }) => (0, codegen_1._)`{propertyName: ${params.propertyName}}`
    };
    var def = {
      keyword: "propertyNames",
      type: "object",
      schemaType: ["object", "boolean"],
      error,
      code(cxt) {
        const { gen, schema: schema2, data, it } = cxt;
        if ((0, util_1.alwaysValidSchema)(it, schema2))
          return;
        const valid = gen.name("valid");
        gen.forIn("key", data, (key) => {
          cxt.setParams({ propertyName: key });
          cxt.subschema({
            keyword: "propertyNames",
            data: key,
            dataTypes: ["string"],
            propertyName: key,
            compositeRule: true
          }, valid);
          gen.if((0, codegen_1.not)(valid), () => {
            cxt.error(true);
            if (!it.allErrors)
              gen.break();
          });
        });
        cxt.ok(valid);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/additionalProperties.js
var require_additionalProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/additionalProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var util_1 = require_util();
    var error = {
      message: "must NOT have additional properties",
      params: ({ params }) => (0, codegen_1._)`{additionalProperty: ${params.additionalProperty}}`
    };
    var def = {
      keyword: "additionalProperties",
      type: ["object"],
      schemaType: ["boolean", "object"],
      allowUndefined: true,
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema: schema2, parentSchema, data, errsCount, it } = cxt;
        if (!errsCount)
          throw new Error("ajv implementation error");
        const { allErrors, opts } = it;
        it.props = true;
        if (opts.removeAdditional !== "all" && (0, util_1.alwaysValidSchema)(it, schema2))
          return;
        const props = (0, code_1.allSchemaProperties)(parentSchema.properties);
        const patProps = (0, code_1.allSchemaProperties)(parentSchema.patternProperties);
        checkAdditionalProperties();
        cxt.ok((0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
        function checkAdditionalProperties() {
          gen.forIn("key", data, (key) => {
            if (!props.length && !patProps.length)
              additionalPropertyCode(key);
            else
              gen.if(isAdditional(key), () => additionalPropertyCode(key));
          });
        }
        function isAdditional(key) {
          let definedProp;
          if (props.length > 8) {
            const propsSchema = (0, util_1.schemaRefOrVal)(it, parentSchema.properties, "properties");
            definedProp = (0, code_1.isOwnProperty)(gen, propsSchema, key);
          } else if (props.length) {
            definedProp = (0, codegen_1.or)(...props.map((p) => (0, codegen_1._)`${key} === ${p}`));
          } else {
            definedProp = codegen_1.nil;
          }
          if (patProps.length) {
            definedProp = (0, codegen_1.or)(definedProp, ...patProps.map((p) => (0, codegen_1._)`${(0, code_1.usePattern)(cxt, p)}.test(${key})`));
          }
          return (0, codegen_1.not)(definedProp);
        }
        function deleteAdditional(key) {
          gen.code((0, codegen_1._)`delete ${data}[${key}]`);
        }
        function additionalPropertyCode(key) {
          if (opts.removeAdditional === "all" || opts.removeAdditional && schema2 === false) {
            deleteAdditional(key);
            return;
          }
          if (schema2 === false) {
            cxt.setParams({ additionalProperty: key });
            cxt.error();
            if (!allErrors)
              gen.break();
            return;
          }
          if (typeof schema2 == "object" && !(0, util_1.alwaysValidSchema)(it, schema2)) {
            const valid = gen.name("valid");
            if (opts.removeAdditional === "failing") {
              applyAdditionalSchema(key, valid, false);
              gen.if((0, codegen_1.not)(valid), () => {
                cxt.reset();
                deleteAdditional(key);
              });
            } else {
              applyAdditionalSchema(key, valid);
              if (!allErrors)
                gen.if((0, codegen_1.not)(valid), () => gen.break());
            }
          }
        }
        function applyAdditionalSchema(key, valid, errors) {
          const subschema = {
            keyword: "additionalProperties",
            dataProp: key,
            dataPropType: util_1.Type.Str
          };
          if (errors === false) {
            Object.assign(subschema, {
              compositeRule: true,
              createErrors: false,
              allErrors: false
            });
          }
          cxt.subschema(subschema, valid);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/properties.js
var require_properties = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/properties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var validate_1 = require_validate();
    var code_1 = require_code2();
    var util_1 = require_util();
    var additionalProperties_1 = require_additionalProperties();
    var def = {
      keyword: "properties",
      type: "object",
      schemaType: "object",
      code(cxt) {
        const { gen, schema: schema2, parentSchema, data, it } = cxt;
        if (it.opts.removeAdditional === "all" && parentSchema.additionalProperties === void 0) {
          additionalProperties_1.default.code(new validate_1.KeywordCxt(it, additionalProperties_1.default, "additionalProperties"));
        }
        const allProps = (0, code_1.allSchemaProperties)(schema2);
        for (const prop of allProps) {
          it.definedProperties.add(prop);
        }
        if (it.opts.unevaluated && allProps.length && it.props !== true) {
          it.props = util_1.mergeEvaluated.props(gen, (0, util_1.toHash)(allProps), it.props);
        }
        const properties = allProps.filter((p) => !(0, util_1.alwaysValidSchema)(it, schema2[p]));
        if (properties.length === 0)
          return;
        const valid = gen.name("valid");
        for (const prop of properties) {
          if (hasDefault(prop)) {
            applyPropertySchema(prop);
          } else {
            gen.if((0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties));
            applyPropertySchema(prop);
            if (!it.allErrors)
              gen.else().var(valid, true);
            gen.endIf();
          }
          cxt.it.definedProperties.add(prop);
          cxt.ok(valid);
        }
        function hasDefault(prop) {
          return it.opts.useDefaults && !it.compositeRule && schema2[prop].default !== void 0;
        }
        function applyPropertySchema(prop) {
          cxt.subschema({
            keyword: "properties",
            schemaProp: prop,
            dataProp: prop
          }, valid);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/patternProperties.js
var require_patternProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/patternProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var util_2 = require_util();
    var def = {
      keyword: "patternProperties",
      type: "object",
      schemaType: "object",
      code(cxt) {
        const { gen, schema: schema2, data, parentSchema, it } = cxt;
        const { opts } = it;
        const patterns = (0, code_1.allSchemaProperties)(schema2);
        const alwaysValidPatterns = patterns.filter((p) => (0, util_1.alwaysValidSchema)(it, schema2[p]));
        if (patterns.length === 0 || alwaysValidPatterns.length === patterns.length && (!it.opts.unevaluated || it.props === true)) {
          return;
        }
        const checkProperties = opts.strictSchema && !opts.allowMatchingProperties && parentSchema.properties;
        const valid = gen.name("valid");
        if (it.props !== true && !(it.props instanceof codegen_1.Name)) {
          it.props = (0, util_2.evaluatedPropsToName)(gen, it.props);
        }
        const { props } = it;
        validatePatternProperties();
        function validatePatternProperties() {
          for (const pat of patterns) {
            if (checkProperties)
              checkMatchingProperties(pat);
            if (it.allErrors) {
              validateProperties(pat);
            } else {
              gen.var(valid, true);
              validateProperties(pat);
              gen.if(valid);
            }
          }
        }
        function checkMatchingProperties(pat) {
          for (const prop in checkProperties) {
            if (new RegExp(pat).test(prop)) {
              (0, util_1.checkStrictMode)(it, `property ${prop} matches pattern ${pat} (use allowMatchingProperties)`);
            }
          }
        }
        function validateProperties(pat) {
          gen.forIn("key", data, (key) => {
            gen.if((0, codegen_1._)`${(0, code_1.usePattern)(cxt, pat)}.test(${key})`, () => {
              const alwaysValid = alwaysValidPatterns.includes(pat);
              if (!alwaysValid) {
                cxt.subschema({
                  keyword: "patternProperties",
                  schemaProp: pat,
                  dataProp: key,
                  dataPropType: util_2.Type.Str
                }, valid);
              }
              if (it.opts.unevaluated && props !== true) {
                gen.assign((0, codegen_1._)`${props}[${key}]`, true);
              } else if (!alwaysValid && !it.allErrors) {
                gen.if((0, codegen_1.not)(valid), () => gen.break());
              }
            });
          });
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/not.js
var require_not = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/not.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: "not",
      schemaType: ["object", "boolean"],
      trackErrors: true,
      code(cxt) {
        const { gen, schema: schema2, it } = cxt;
        if ((0, util_1.alwaysValidSchema)(it, schema2)) {
          cxt.fail();
          return;
        }
        const valid = gen.name("valid");
        cxt.subschema({
          keyword: "not",
          compositeRule: true,
          createErrors: false,
          allErrors: false
        }, valid);
        cxt.failResult(valid, () => cxt.reset(), () => cxt.error());
      },
      error: { message: "must NOT be valid" }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/anyOf.js
var require_anyOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/anyOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var def = {
      keyword: "anyOf",
      schemaType: "array",
      trackErrors: true,
      code: code_1.validateUnion,
      error: { message: "must match a schema in anyOf" }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/oneOf.js
var require_oneOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/oneOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: "must match exactly one schema in oneOf",
      params: ({ params }) => (0, codegen_1._)`{passingSchemas: ${params.passing}}`
    };
    var def = {
      keyword: "oneOf",
      schemaType: "array",
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema: schema2, parentSchema, it } = cxt;
        if (!Array.isArray(schema2))
          throw new Error("ajv implementation error");
        if (it.opts.discriminator && parentSchema.discriminator)
          return;
        const schArr = schema2;
        const valid = gen.let("valid", false);
        const passing = gen.let("passing", null);
        const schValid = gen.name("_valid");
        cxt.setParams({ passing });
        gen.block(validateOneOf);
        cxt.result(valid, () => cxt.reset(), () => cxt.error(true));
        function validateOneOf() {
          schArr.forEach((sch, i) => {
            let schCxt;
            if ((0, util_1.alwaysValidSchema)(it, sch)) {
              gen.var(schValid, true);
            } else {
              schCxt = cxt.subschema({
                keyword: "oneOf",
                schemaProp: i,
                compositeRule: true
              }, schValid);
            }
            if (i > 0) {
              gen.if((0, codegen_1._)`${schValid} && ${valid}`).assign(valid, false).assign(passing, (0, codegen_1._)`[${passing}, ${i}]`).else();
            }
            gen.if(schValid, () => {
              gen.assign(valid, true);
              gen.assign(passing, i);
              if (schCxt)
                cxt.mergeEvaluated(schCxt, codegen_1.Name);
            });
          });
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/allOf.js
var require_allOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/allOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: "allOf",
      schemaType: "array",
      code(cxt) {
        const { gen, schema: schema2, it } = cxt;
        if (!Array.isArray(schema2))
          throw new Error("ajv implementation error");
        const valid = gen.name("valid");
        schema2.forEach((sch, i) => {
          if ((0, util_1.alwaysValidSchema)(it, sch))
            return;
          const schCxt = cxt.subschema({ keyword: "allOf", schemaProp: i }, valid);
          cxt.ok(valid);
          cxt.mergeEvaluated(schCxt);
        });
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/if.js
var require_if = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/if.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params }) => (0, codegen_1.str)`must match "${params.ifClause}" schema`,
      params: ({ params }) => (0, codegen_1._)`{failingKeyword: ${params.ifClause}}`
    };
    var def = {
      keyword: "if",
      schemaType: ["object", "boolean"],
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, parentSchema, it } = cxt;
        if (parentSchema.then === void 0 && parentSchema.else === void 0) {
          (0, util_1.checkStrictMode)(it, '"if" without "then" and "else" is ignored');
        }
        const hasThen = hasSchema(it, "then");
        const hasElse = hasSchema(it, "else");
        if (!hasThen && !hasElse)
          return;
        const valid = gen.let("valid", true);
        const schValid = gen.name("_valid");
        validateIf();
        cxt.reset();
        if (hasThen && hasElse) {
          const ifClause = gen.let("ifClause");
          cxt.setParams({ ifClause });
          gen.if(schValid, validateClause("then", ifClause), validateClause("else", ifClause));
        } else if (hasThen) {
          gen.if(schValid, validateClause("then"));
        } else {
          gen.if((0, codegen_1.not)(schValid), validateClause("else"));
        }
        cxt.pass(valid, () => cxt.error(true));
        function validateIf() {
          const schCxt = cxt.subschema({
            keyword: "if",
            compositeRule: true,
            createErrors: false,
            allErrors: false
          }, schValid);
          cxt.mergeEvaluated(schCxt);
        }
        function validateClause(keyword, ifClause) {
          return () => {
            const schCxt = cxt.subschema({ keyword }, schValid);
            gen.assign(valid, schValid);
            cxt.mergeValidEvaluated(schCxt, valid);
            if (ifClause)
              gen.assign(ifClause, (0, codegen_1._)`${keyword}`);
            else
              cxt.setParams({ ifClause: keyword });
          };
        }
      }
    };
    function hasSchema(it, keyword) {
      const schema2 = it.schema[keyword];
      return schema2 !== void 0 && !(0, util_1.alwaysValidSchema)(it, schema2);
    }
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/thenElse.js
var require_thenElse = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/thenElse.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: ["then", "else"],
      schemaType: ["object", "boolean"],
      code({ keyword, parentSchema, it }) {
        if (parentSchema.if === void 0)
          (0, util_1.checkStrictMode)(it, `"${keyword}" without "if" is ignored`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/index.js
var require_applicator = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var additionalItems_1 = require_additionalItems();
    var prefixItems_1 = require_prefixItems();
    var items_1 = require_items();
    var items2020_1 = require_items2020();
    var contains_1 = require_contains();
    var dependencies_1 = require_dependencies();
    var propertyNames_1 = require_propertyNames();
    var additionalProperties_1 = require_additionalProperties();
    var properties_1 = require_properties();
    var patternProperties_1 = require_patternProperties();
    var not_1 = require_not();
    var anyOf_1 = require_anyOf();
    var oneOf_1 = require_oneOf();
    var allOf_1 = require_allOf();
    var if_1 = require_if();
    var thenElse_1 = require_thenElse();
    function getApplicator(draft2020 = false) {
      const applicator = [
        // any
        not_1.default,
        anyOf_1.default,
        oneOf_1.default,
        allOf_1.default,
        if_1.default,
        thenElse_1.default,
        // object
        propertyNames_1.default,
        additionalProperties_1.default,
        dependencies_1.default,
        properties_1.default,
        patternProperties_1.default
      ];
      if (draft2020)
        applicator.push(prefixItems_1.default, items2020_1.default);
      else
        applicator.push(additionalItems_1.default, items_1.default);
      applicator.push(contains_1.default);
      return applicator;
    }
    exports.default = getApplicator;
  }
});

// node_modules/ajv/dist/vocabularies/format/format.js
var require_format = __commonJS({
  "node_modules/ajv/dist/vocabularies/format/format.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must match format "${schemaCode}"`,
      params: ({ schemaCode }) => (0, codegen_1._)`{format: ${schemaCode}}`
    };
    var def = {
      keyword: "format",
      type: ["number", "string"],
      schemaType: "string",
      $data: true,
      error,
      code(cxt, ruleType) {
        const { gen, data, $data, schema: schema2, schemaCode, it } = cxt;
        const { opts, errSchemaPath, schemaEnv, self } = it;
        if (!opts.validateFormats)
          return;
        if ($data)
          validate$DataFormat();
        else
          validateFormat();
        function validate$DataFormat() {
          const fmts = gen.scopeValue("formats", {
            ref: self.formats,
            code: opts.code.formats
          });
          const fDef = gen.const("fDef", (0, codegen_1._)`${fmts}[${schemaCode}]`);
          const fType = gen.let("fType");
          const format2 = gen.let("format");
          gen.if((0, codegen_1._)`typeof ${fDef} == "object" && !(${fDef} instanceof RegExp)`, () => gen.assign(fType, (0, codegen_1._)`${fDef}.type || "string"`).assign(format2, (0, codegen_1._)`${fDef}.validate`), () => gen.assign(fType, (0, codegen_1._)`"string"`).assign(format2, fDef));
          cxt.fail$data((0, codegen_1.or)(unknownFmt(), invalidFmt()));
          function unknownFmt() {
            if (opts.strictSchema === false)
              return codegen_1.nil;
            return (0, codegen_1._)`${schemaCode} && !${format2}`;
          }
          function invalidFmt() {
            const callFormat = schemaEnv.$async ? (0, codegen_1._)`(${fDef}.async ? await ${format2}(${data}) : ${format2}(${data}))` : (0, codegen_1._)`${format2}(${data})`;
            const validData = (0, codegen_1._)`(typeof ${format2} == "function" ? ${callFormat} : ${format2}.test(${data}))`;
            return (0, codegen_1._)`${format2} && ${format2} !== true && ${fType} === ${ruleType} && !${validData}`;
          }
        }
        function validateFormat() {
          const formatDef = self.formats[schema2];
          if (!formatDef) {
            unknownFormat();
            return;
          }
          if (formatDef === true)
            return;
          const [fmtType, format2, fmtRef] = getFormat(formatDef);
          if (fmtType === ruleType)
            cxt.pass(validCondition());
          function unknownFormat() {
            if (opts.strictSchema === false) {
              self.logger.warn(unknownMsg());
              return;
            }
            throw new Error(unknownMsg());
            function unknownMsg() {
              return `unknown format "${schema2}" ignored in schema at path "${errSchemaPath}"`;
            }
          }
          function getFormat(fmtDef) {
            const code = fmtDef instanceof RegExp ? (0, codegen_1.regexpCode)(fmtDef) : opts.code.formats ? (0, codegen_1._)`${opts.code.formats}${(0, codegen_1.getProperty)(schema2)}` : void 0;
            const fmt = gen.scopeValue("formats", { key: schema2, ref: fmtDef, code });
            if (typeof fmtDef == "object" && !(fmtDef instanceof RegExp)) {
              return [fmtDef.type || "string", fmtDef.validate, (0, codegen_1._)`${fmt}.validate`];
            }
            return ["string", fmtDef, fmt];
          }
          function validCondition() {
            if (typeof formatDef == "object" && !(formatDef instanceof RegExp) && formatDef.async) {
              if (!schemaEnv.$async)
                throw new Error("async format in sync schema");
              return (0, codegen_1._)`await ${fmtRef}(${data})`;
            }
            return typeof format2 == "function" ? (0, codegen_1._)`${fmtRef}(${data})` : (0, codegen_1._)`${fmtRef}.test(${data})`;
          }
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/format/index.js
var require_format2 = __commonJS({
  "node_modules/ajv/dist/vocabularies/format/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var format_1 = require_format();
    var format2 = [format_1.default];
    exports.default = format2;
  }
});

// node_modules/ajv/dist/vocabularies/metadata.js
var require_metadata = __commonJS({
  "node_modules/ajv/dist/vocabularies/metadata.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.contentVocabulary = exports.metadataVocabulary = void 0;
    exports.metadataVocabulary = [
      "title",
      "description",
      "default",
      "deprecated",
      "readOnly",
      "writeOnly",
      "examples"
    ];
    exports.contentVocabulary = [
      "contentMediaType",
      "contentEncoding",
      "contentSchema"
    ];
  }
});

// node_modules/ajv/dist/vocabularies/draft7.js
var require_draft7 = __commonJS({
  "node_modules/ajv/dist/vocabularies/draft7.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var core_1 = require_core2();
    var validation_1 = require_validation();
    var applicator_1 = require_applicator();
    var format_1 = require_format2();
    var metadata_1 = require_metadata();
    var draft7Vocabularies = [
      core_1.default,
      validation_1.default,
      (0, applicator_1.default)(),
      format_1.default,
      metadata_1.metadataVocabulary,
      metadata_1.contentVocabulary
    ];
    exports.default = draft7Vocabularies;
  }
});

// node_modules/ajv/dist/vocabularies/discriminator/types.js
var require_types = __commonJS({
  "node_modules/ajv/dist/vocabularies/discriminator/types.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DiscrError = void 0;
    var DiscrError;
    (function(DiscrError2) {
      DiscrError2["Tag"] = "tag";
      DiscrError2["Mapping"] = "mapping";
    })(DiscrError || (exports.DiscrError = DiscrError = {}));
  }
});

// node_modules/ajv/dist/vocabularies/discriminator/index.js
var require_discriminator = __commonJS({
  "node_modules/ajv/dist/vocabularies/discriminator/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var types_1 = require_types();
    var compile_1 = require_compile();
    var ref_error_1 = require_ref_error();
    var util_1 = require_util();
    var error = {
      message: ({ params: { discrError, tagName } }) => discrError === types_1.DiscrError.Tag ? `tag "${tagName}" must be string` : `value of tag "${tagName}" must be in oneOf`,
      params: ({ params: { discrError, tag, tagName } }) => (0, codegen_1._)`{error: ${discrError}, tag: ${tagName}, tagValue: ${tag}}`
    };
    var def = {
      keyword: "discriminator",
      type: "object",
      schemaType: "object",
      error,
      code(cxt) {
        const { gen, data, schema: schema2, parentSchema, it } = cxt;
        const { oneOf } = parentSchema;
        if (!it.opts.discriminator) {
          throw new Error("discriminator: requires discriminator option");
        }
        const tagName = schema2.propertyName;
        if (typeof tagName != "string")
          throw new Error("discriminator: requires propertyName");
        if (schema2.mapping)
          throw new Error("discriminator: mapping is not supported");
        if (!oneOf)
          throw new Error("discriminator: requires oneOf keyword");
        const valid = gen.let("valid", false);
        const tag = gen.const("tag", (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(tagName)}`);
        gen.if((0, codegen_1._)`typeof ${tag} == "string"`, () => validateMapping(), () => cxt.error(false, { discrError: types_1.DiscrError.Tag, tag, tagName }));
        cxt.ok(valid);
        function validateMapping() {
          const mapping = getMapping();
          gen.if(false);
          for (const tagValue in mapping) {
            gen.elseIf((0, codegen_1._)`${tag} === ${tagValue}`);
            gen.assign(valid, applyTagSchema(mapping[tagValue]));
          }
          gen.else();
          cxt.error(false, { discrError: types_1.DiscrError.Mapping, tag, tagName });
          gen.endIf();
        }
        function applyTagSchema(schemaProp) {
          const _valid = gen.name("valid");
          const schCxt = cxt.subschema({ keyword: "oneOf", schemaProp }, _valid);
          cxt.mergeEvaluated(schCxt, codegen_1.Name);
          return _valid;
        }
        function getMapping() {
          var _a;
          const oneOfMapping = {};
          const topRequired = hasRequired(parentSchema);
          let tagRequired = true;
          for (let i = 0; i < oneOf.length; i++) {
            let sch = oneOf[i];
            if ((sch === null || sch === void 0 ? void 0 : sch.$ref) && !(0, util_1.schemaHasRulesButRef)(sch, it.self.RULES)) {
              const ref = sch.$ref;
              sch = compile_1.resolveRef.call(it.self, it.schemaEnv.root, it.baseId, ref);
              if (sch instanceof compile_1.SchemaEnv)
                sch = sch.schema;
              if (sch === void 0)
                throw new ref_error_1.default(it.opts.uriResolver, it.baseId, ref);
            }
            const propSch = (_a = sch === null || sch === void 0 ? void 0 : sch.properties) === null || _a === void 0 ? void 0 : _a[tagName];
            if (typeof propSch != "object") {
              throw new Error(`discriminator: oneOf subschemas (or referenced schemas) must have "properties/${tagName}"`);
            }
            tagRequired = tagRequired && (topRequired || hasRequired(sch));
            addMappings(propSch, i);
          }
          if (!tagRequired)
            throw new Error(`discriminator: "${tagName}" must be required`);
          return oneOfMapping;
          function hasRequired({ required }) {
            return Array.isArray(required) && required.includes(tagName);
          }
          function addMappings(sch, i) {
            if (sch.const) {
              addMapping(sch.const, i);
            } else if (sch.enum) {
              for (const tagValue of sch.enum) {
                addMapping(tagValue, i);
              }
            } else {
              throw new Error(`discriminator: "properties/${tagName}" must have "const" or "enum"`);
            }
          }
          function addMapping(tagValue, i) {
            if (typeof tagValue != "string" || tagValue in oneOfMapping) {
              throw new Error(`discriminator: "${tagName}" values must be unique strings`);
            }
            oneOfMapping[tagValue] = i;
          }
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/refs/json-schema-draft-07.json
var require_json_schema_draft_07 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-draft-07.json"(exports, module) {
    module.exports = {
      $schema: "http://json-schema.org/draft-07/schema#",
      $id: "http://json-schema.org/draft-07/schema#",
      title: "Core schema meta-schema",
      definitions: {
        schemaArray: {
          type: "array",
          minItems: 1,
          items: { $ref: "#" }
        },
        nonNegativeInteger: {
          type: "integer",
          minimum: 0
        },
        nonNegativeIntegerDefault0: {
          allOf: [{ $ref: "#/definitions/nonNegativeInteger" }, { default: 0 }]
        },
        simpleTypes: {
          enum: ["array", "boolean", "integer", "null", "number", "object", "string"]
        },
        stringArray: {
          type: "array",
          items: { type: "string" },
          uniqueItems: true,
          default: []
        }
      },
      type: ["object", "boolean"],
      properties: {
        $id: {
          type: "string",
          format: "uri-reference"
        },
        $schema: {
          type: "string",
          format: "uri"
        },
        $ref: {
          type: "string",
          format: "uri-reference"
        },
        $comment: {
          type: "string"
        },
        title: {
          type: "string"
        },
        description: {
          type: "string"
        },
        default: true,
        readOnly: {
          type: "boolean",
          default: false
        },
        examples: {
          type: "array",
          items: true
        },
        multipleOf: {
          type: "number",
          exclusiveMinimum: 0
        },
        maximum: {
          type: "number"
        },
        exclusiveMaximum: {
          type: "number"
        },
        minimum: {
          type: "number"
        },
        exclusiveMinimum: {
          type: "number"
        },
        maxLength: { $ref: "#/definitions/nonNegativeInteger" },
        minLength: { $ref: "#/definitions/nonNegativeIntegerDefault0" },
        pattern: {
          type: "string",
          format: "regex"
        },
        additionalItems: { $ref: "#" },
        items: {
          anyOf: [{ $ref: "#" }, { $ref: "#/definitions/schemaArray" }],
          default: true
        },
        maxItems: { $ref: "#/definitions/nonNegativeInteger" },
        minItems: { $ref: "#/definitions/nonNegativeIntegerDefault0" },
        uniqueItems: {
          type: "boolean",
          default: false
        },
        contains: { $ref: "#" },
        maxProperties: { $ref: "#/definitions/nonNegativeInteger" },
        minProperties: { $ref: "#/definitions/nonNegativeIntegerDefault0" },
        required: { $ref: "#/definitions/stringArray" },
        additionalProperties: { $ref: "#" },
        definitions: {
          type: "object",
          additionalProperties: { $ref: "#" },
          default: {}
        },
        properties: {
          type: "object",
          additionalProperties: { $ref: "#" },
          default: {}
        },
        patternProperties: {
          type: "object",
          additionalProperties: { $ref: "#" },
          propertyNames: { format: "regex" },
          default: {}
        },
        dependencies: {
          type: "object",
          additionalProperties: {
            anyOf: [{ $ref: "#" }, { $ref: "#/definitions/stringArray" }]
          }
        },
        propertyNames: { $ref: "#" },
        const: true,
        enum: {
          type: "array",
          items: true,
          minItems: 1,
          uniqueItems: true
        },
        type: {
          anyOf: [
            { $ref: "#/definitions/simpleTypes" },
            {
              type: "array",
              items: { $ref: "#/definitions/simpleTypes" },
              minItems: 1,
              uniqueItems: true
            }
          ]
        },
        format: { type: "string" },
        contentMediaType: { type: "string" },
        contentEncoding: { type: "string" },
        if: { $ref: "#" },
        then: { $ref: "#" },
        else: { $ref: "#" },
        allOf: { $ref: "#/definitions/schemaArray" },
        anyOf: { $ref: "#/definitions/schemaArray" },
        oneOf: { $ref: "#/definitions/schemaArray" },
        not: { $ref: "#" }
      },
      default: true
    };
  }
});

// node_modules/ajv/dist/ajv.js
var require_ajv = __commonJS({
  "node_modules/ajv/dist/ajv.js"(exports, module) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MissingRefError = exports.ValidationError = exports.CodeGen = exports.Name = exports.nil = exports.stringify = exports.str = exports._ = exports.KeywordCxt = exports.Ajv = void 0;
    var core_1 = require_core();
    var draft7_1 = require_draft7();
    var discriminator_1 = require_discriminator();
    var draft7MetaSchema = require_json_schema_draft_07();
    var META_SUPPORT_DATA = ["/properties"];
    var META_SCHEMA_ID = "http://json-schema.org/draft-07/schema";
    var Ajv2 = class extends core_1.default {
      _addVocabularies() {
        super._addVocabularies();
        draft7_1.default.forEach((v) => this.addVocabulary(v));
        if (this.opts.discriminator)
          this.addKeyword(discriminator_1.default);
      }
      _addDefaultMetaSchema() {
        super._addDefaultMetaSchema();
        if (!this.opts.meta)
          return;
        const metaSchema = this.opts.$data ? this.$dataMetaSchema(draft7MetaSchema, META_SUPPORT_DATA) : draft7MetaSchema;
        this.addMetaSchema(metaSchema, META_SCHEMA_ID, false);
        this.refs["http://json-schema.org/schema"] = META_SCHEMA_ID;
      }
      defaultMeta() {
        return this.opts.defaultMeta = super.defaultMeta() || (this.getSchema(META_SCHEMA_ID) ? META_SCHEMA_ID : void 0);
      }
    };
    exports.Ajv = Ajv2;
    module.exports = exports = Ajv2;
    module.exports.Ajv = Ajv2;
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = Ajv2;
    var validate_1 = require_validate();
    Object.defineProperty(exports, "KeywordCxt", { enumerable: true, get: function() {
      return validate_1.KeywordCxt;
    } });
    var codegen_1 = require_codegen();
    Object.defineProperty(exports, "_", { enumerable: true, get: function() {
      return codegen_1._;
    } });
    Object.defineProperty(exports, "str", { enumerable: true, get: function() {
      return codegen_1.str;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
      return codegen_1.stringify;
    } });
    Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
      return codegen_1.nil;
    } });
    Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
      return codegen_1.Name;
    } });
    Object.defineProperty(exports, "CodeGen", { enumerable: true, get: function() {
      return codegen_1.CodeGen;
    } });
    var validation_error_1 = require_validation_error();
    Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function() {
      return validation_error_1.default;
    } });
    var ref_error_1 = require_ref_error();
    Object.defineProperty(exports, "MissingRefError", { enumerable: true, get: function() {
      return ref_error_1.default;
    } });
  }
});

// src/cli/main.ts
import { readdirSync, readFileSync } from "node:fs";
import { join as join2, resolve as resolve2 } from "node:path";
import { parseArgs } from "node:util";

// node_modules/@actions/expressions/dist/ast.js
var Expr = class {
};
var Literal = class extends Expr {
  constructor(literal, token) {
    super();
    this.literal = literal;
    this.token = token;
  }
  accept(v) {
    return v.visitLiteral(this);
  }
};
var Unary = class extends Expr {
  constructor(operator, expr) {
    super();
    this.operator = operator;
    this.expr = expr;
  }
  accept(v) {
    return v.visitUnary(this);
  }
};
var FunctionCall = class extends Expr {
  constructor(functionName, args) {
    super();
    this.functionName = functionName;
    this.args = args;
  }
  accept(v) {
    return v.visitFunctionCall(this);
  }
};
var Binary = class extends Expr {
  constructor(left, operator, right) {
    super();
    this.left = left;
    this.operator = operator;
    this.right = right;
  }
  accept(v) {
    return v.visitBinary(this);
  }
};
var Logical = class extends Expr {
  constructor(operator, args) {
    super();
    this.operator = operator;
    this.args = args;
  }
  accept(v) {
    return v.visitLogical(this);
  }
};
var Grouping = class extends Expr {
  constructor(group) {
    super();
    this.group = group;
  }
  accept(v) {
    return v.visitGrouping(this);
  }
};
var ContextAccess = class extends Expr {
  constructor(name2) {
    super();
    this.name = name2;
  }
  accept(v) {
    return v.visitContextAccess(this);
  }
};
var IndexAccess = class extends Expr {
  constructor(expr, index) {
    super();
    this.expr = expr;
    this.index = index;
  }
  accept(v) {
    return v.visitIndexAccess(this);
  }
};
var Star = class extends Expr {
  accept() {
    throw new Error("Method not implemented.");
  }
};

// node_modules/@actions/expressions/dist/data/expressiondata.js
var Kind;
(function(Kind2) {
  Kind2[Kind2["String"] = 0] = "String";
  Kind2[Kind2["Array"] = 1] = "Array";
  Kind2[Kind2["Dictionary"] = 2] = "Dictionary";
  Kind2[Kind2["Boolean"] = 3] = "Boolean";
  Kind2[Kind2["Number"] = 4] = "Number";
  Kind2[Kind2["CaseSensitiveDictionary"] = 5] = "CaseSensitiveDictionary";
  Kind2[Kind2["Null"] = 6] = "Null";
})(Kind || (Kind = {}));
function kindStr(k) {
  switch (k) {
    case Kind.Array:
      return "Array";
    case Kind.Boolean:
      return "Boolean";
    case Kind.Null:
      return "Null";
    case Kind.Number:
      return "Number";
    case Kind.Dictionary:
      return "Object";
    case Kind.String:
      return "String";
  }
  return "unknown";
}

// node_modules/@actions/expressions/dist/data/dictionary.js
var Dictionary = class {
  constructor(...pairs) {
    this.keys = [];
    this.v = [];
    this.indexMap = {};
    this.kind = Kind.Dictionary;
    this.primitive = false;
    for (const p of pairs) {
      this.add(p.key, p.value);
    }
  }
  coerceString() {
    return kindStr(this.kind);
  }
  number() {
    return NaN;
  }
  add(key, value) {
    if (key.toLowerCase() in this.indexMap) {
      return;
    }
    this.keys.push(key);
    this.v.push(value);
    this.indexMap[key.toLowerCase()] = this.v.length - 1;
  }
  get(key) {
    const index = this.indexMap[key.toLowerCase()];
    if (index === void 0) {
      return void 0;
    }
    return this.v[index];
  }
  values() {
    return this.v;
  }
  pairs() {
    const result = [];
    for (const key of this.keys) {
      result.push({ key, value: this.v[this.indexMap[key.toLowerCase()]] });
    }
    return result;
  }
};

// node_modules/@actions/expressions/dist/data/index.js
var data_exports = {};
__export(data_exports, {
  Array: () => Array2,
  BooleanData: () => BooleanData,
  Dictionary: () => Dictionary,
  Kind: () => Kind,
  Null: () => Null,
  NumberData: () => NumberData,
  StringData: () => StringData,
  replacer: () => replacer,
  reviver: () => reviver
});

// node_modules/@actions/expressions/dist/data/array.js
var Array2 = class {
  constructor(...data) {
    this.v = [];
    this.kind = Kind.Array;
    this.primitive = false;
    for (const d of data) {
      this.add(d);
    }
  }
  coerceString() {
    return kindStr(this.kind);
  }
  number() {
    return NaN;
  }
  add(value) {
    this.v.push(value);
  }
  get(index) {
    return this.v[index];
  }
  values() {
    return this.v;
  }
};

// node_modules/@actions/expressions/dist/data/boolean.js
var BooleanData = class {
  constructor(value) {
    this.value = value;
    this.kind = Kind.Boolean;
    this.primitive = true;
  }
  coerceString() {
    if (this.value) {
      return "true";
    }
    return "false";
  }
  number() {
    if (this.value) {
      return 1;
    }
    return 0;
  }
};

// node_modules/@actions/expressions/dist/data/null.js
var Null = class {
  constructor() {
    this.kind = Kind.Null;
    this.primitive = true;
  }
  coerceString() {
    return "";
  }
  number() {
    return 0;
  }
};

// node_modules/@actions/expressions/dist/data/number.js
var NumberData = class {
  constructor(value) {
    this.value = value;
    this.kind = Kind.Number;
    this.primitive = true;
  }
  coerceString() {
    if (this.value === 0) {
      return "0";
    }
    return (+this.value.toFixed(15)).toString();
  }
  number() {
    return this.value;
  }
};

// node_modules/@actions/expressions/dist/data/string.js
var StringData = class {
  constructor(value) {
    this.value = value;
    this.kind = Kind.String;
    this.primitive = true;
  }
  coerceString() {
    return this.value;
  }
  number() {
    return Number(this.value);
  }
};

// node_modules/@actions/expressions/dist/data/replacer.js
function replacer(_key, value) {
  if (value instanceof Null) {
    return null;
  }
  if (value instanceof BooleanData) {
    return value.value;
  }
  if (value instanceof NumberData) {
    return value.number();
  }
  if (value instanceof StringData) {
    return value.coerceString();
  }
  if (value instanceof Array2) {
    return value.values();
  }
  if (value instanceof Dictionary) {
    const pairs = value.pairs();
    const r = {};
    for (const p of pairs) {
      r[p.key] = p.value;
    }
    return r;
  }
  return value;
}

// node_modules/@actions/expressions/dist/data/reviver.js
function reviver(_key, val) {
  if (val === null) {
    return new Null();
  }
  if (typeof val === "string") {
    return new StringData(val);
  }
  if (typeof val === "number") {
    return new NumberData(val);
  }
  if (typeof val === "boolean") {
    return new BooleanData(val);
  }
  if (Array.isArray(val)) {
    return new Array2(...val);
  }
  if (typeof val === "object") {
    return new Dictionary(...Object.keys(val).map((k) => ({
      key: k,
      value: val[k]
    })));
  }
  return val;
}

// node_modules/@actions/expressions/dist/lexer.js
var TokenType;
(function(TokenType3) {
  TokenType3[TokenType3["UNKNOWN"] = 0] = "UNKNOWN";
  TokenType3[TokenType3["LEFT_PAREN"] = 1] = "LEFT_PAREN";
  TokenType3[TokenType3["RIGHT_PAREN"] = 2] = "RIGHT_PAREN";
  TokenType3[TokenType3["LEFT_BRACKET"] = 3] = "LEFT_BRACKET";
  TokenType3[TokenType3["RIGHT_BRACKET"] = 4] = "RIGHT_BRACKET";
  TokenType3[TokenType3["COMMA"] = 5] = "COMMA";
  TokenType3[TokenType3["DOT"] = 6] = "DOT";
  TokenType3[TokenType3["BANG"] = 7] = "BANG";
  TokenType3[TokenType3["BANG_EQUAL"] = 8] = "BANG_EQUAL";
  TokenType3[TokenType3["EQUAL_EQUAL"] = 9] = "EQUAL_EQUAL";
  TokenType3[TokenType3["GREATER"] = 10] = "GREATER";
  TokenType3[TokenType3["GREATER_EQUAL"] = 11] = "GREATER_EQUAL";
  TokenType3[TokenType3["LESS"] = 12] = "LESS";
  TokenType3[TokenType3["LESS_EQUAL"] = 13] = "LESS_EQUAL";
  TokenType3[TokenType3["AND"] = 14] = "AND";
  TokenType3[TokenType3["OR"] = 15] = "OR";
  TokenType3[TokenType3["STAR"] = 16] = "STAR";
  TokenType3[TokenType3["NUMBER"] = 17] = "NUMBER";
  TokenType3[TokenType3["STRING"] = 18] = "STRING";
  TokenType3[TokenType3["IDENTIFIER"] = 19] = "IDENTIFIER";
  TokenType3[TokenType3["TRUE"] = 20] = "TRUE";
  TokenType3[TokenType3["FALSE"] = 21] = "FALSE";
  TokenType3[TokenType3["NULL"] = 22] = "NULL";
  TokenType3[TokenType3["EOF"] = 23] = "EOF";
})(TokenType || (TokenType = {}));
function tokenString(tok) {
  switch (tok.type) {
    case TokenType.EOF:
      return "EOF";
    case TokenType.NUMBER:
      return tok.lexeme;
    case TokenType.STRING:
      return tok.value.toString();
    default:
      return tok.lexeme;
  }
}
var Lexer = class {
  constructor(input) {
    this.input = input;
    this.start = 0;
    this.offset = 0;
    this.line = 0;
    this.lastLineOffset = 0;
    this.tokens = [];
  }
  lex() {
    if (this.input.length > MAX_EXPRESSION_LENGTH) {
      throw new Error("ErrorExceededMaxLength");
    }
    while (!this.atEnd()) {
      this.start = this.offset;
      const c = this.next();
      switch (c) {
        case "(":
          this.addToken(TokenType.LEFT_PAREN);
          break;
        case ")":
          this.addToken(TokenType.RIGHT_PAREN);
          break;
        case "[":
          this.addToken(TokenType.LEFT_BRACKET);
          break;
        case "]":
          this.addToken(TokenType.RIGHT_BRACKET);
          break;
        case ",":
          this.addToken(TokenType.COMMA);
          break;
        case ".":
          if (this.previous() != TokenType.IDENTIFIER && this.previous() != TokenType.RIGHT_BRACKET && this.previous() != TokenType.RIGHT_PAREN && this.previous() != TokenType.STAR) {
            this.consumeNumber();
          } else {
            this.addToken(TokenType.DOT);
          }
          break;
        case "-":
        case "+":
          this.consumeNumber();
          break;
        case "!":
          this.addToken(this.match("=") ? TokenType.BANG_EQUAL : TokenType.BANG);
          break;
        case "=":
          if (!this.match("=")) {
            this.consumeIdentifier();
            break;
          }
          this.addToken(TokenType.EQUAL_EQUAL);
          break;
        case "<":
          this.addToken(this.match("=") ? TokenType.LESS_EQUAL : TokenType.LESS);
          break;
        case ">":
          this.addToken(this.match("=") ? TokenType.GREATER_EQUAL : TokenType.GREATER);
          break;
        case "&":
          if (!this.match("&")) {
            this.consumeIdentifier();
            break;
          }
          this.addToken(TokenType.AND);
          break;
        case "|":
          if (!this.match("|")) {
            this.consumeIdentifier();
            break;
          }
          this.addToken(TokenType.OR);
          break;
        case "*":
          this.addToken(TokenType.STAR);
          break;
        // Ignore whitespace.
        case " ":
        case "\r":
        case "	":
          break;
        case "\n":
          ++this.line;
          this.lastLineOffset = this.offset;
          break;
        case "'":
          this.consumeString();
          break;
        default:
          switch (true) {
            case isDigit(c):
              this.consumeNumber();
              break;
            default:
              this.consumeIdentifier();
              break;
          }
      }
    }
    this.tokens.push({
      type: TokenType.EOF,
      lexeme: "",
      range: this.range()
    });
    return {
      tokens: this.tokens
    };
  }
  pos() {
    return {
      line: this.line,
      column: this.start - this.lastLineOffset
    };
  }
  endPos() {
    return {
      line: this.line,
      column: this.offset - this.lastLineOffset
    };
  }
  range() {
    return {
      start: this.pos(),
      end: this.endPos()
    };
  }
  atEnd() {
    return this.offset >= this.input.length;
  }
  peek() {
    if (this.atEnd()) {
      return "\0";
    }
    return this.input[this.offset];
  }
  peekNext() {
    if (this.offset + 1 >= this.input.length) {
      return "\0";
    }
    return this.input[this.offset + 1];
  }
  previous() {
    const l = this.tokens.length;
    if (l == 0) {
      return TokenType.EOF;
    }
    return this.tokens[l - 1].type;
  }
  next() {
    return this.input[this.offset++];
  }
  match(expected) {
    if (this.atEnd()) {
      return false;
    }
    if (this.input[this.offset] !== expected) {
      return false;
    }
    this.offset++;
    return true;
  }
  addToken(type, value) {
    this.tokens.push({
      type,
      lexeme: this.input.substring(this.start, this.offset),
      range: this.range(),
      value
    });
  }
  consumeNumber() {
    while (!this.atEnd() && (!isBoundary(this.peek()) || this.peek() == ".")) {
      this.next();
    }
    const lexeme = this.input.substring(this.start, this.offset);
    const value = new StringData(lexeme).number();
    if (isNaN(value)) {
      throw new Error(`Unexpected symbol: '${lexeme}'. Located at position ${this.start + 1} within expression: ${this.input}`);
    }
    this.addToken(TokenType.NUMBER, value);
  }
  consumeString() {
    while ((this.peek() !== "'" || this.peekNext() === "'") && !this.atEnd()) {
      if (this.peek() === "\n")
        this.line++;
      if (this.peek() === "'" && this.peekNext() === "'") {
        this.next();
      }
      this.next();
    }
    if (this.atEnd()) {
      throw new Error(`Unexpected symbol: '${this.input.substring(this.start)}'. Located at position ${this.start + 1} within expression: ${this.input}`);
    }
    this.next();
    let value = this.input.substring(this.start + 1, this.offset - 1);
    value = value.replace("''", "'");
    this.addToken(TokenType.STRING, value);
  }
  consumeIdentifier() {
    while (!this.atEnd() && !isBoundary(this.peek())) {
      this.next();
    }
    let tokenType = TokenType.IDENTIFIER;
    let tokenValue = void 0;
    const lexeme = this.input.substring(this.start, this.offset);
    if (this.previous() != TokenType.DOT) {
      switch (lexeme) {
        case "true":
          tokenType = TokenType.TRUE;
          break;
        case "false":
          tokenType = TokenType.FALSE;
          break;
        case "null":
          tokenType = TokenType.NULL;
          break;
        case "NaN":
          tokenType = TokenType.NUMBER;
          tokenValue = NaN;
          break;
        case "Infinity":
          tokenType = TokenType.NUMBER;
          tokenValue = Infinity;
          break;
      }
    }
    if (!isLegalIdentifier(lexeme)) {
      throw new Error(`Unexpected symbol: '${lexeme}'. Located at position ${this.start + 1} within expression: ${this.input}`);
    }
    this.addToken(tokenType, tokenValue);
  }
};
function isDigit(c) {
  return c >= "0" && c <= "9";
}
function isBoundary(c) {
  switch (c) {
    case "(":
    case "[":
    case ")":
    case "]":
    case ",":
    case ".":
    case "!":
    case ">":
    case "<":
    case "=":
    case "&":
    case "|":
      return true;
  }
  return /\s/.test(c);
}
function isLegalIdentifier(str) {
  if (str == "") {
    return false;
  }
  const first = str[0];
  if (first >= "a" && first <= "z" || first >= "A" && first <= "Z" || first == "_") {
    for (const c of str.substring(1).split("")) {
      if (c >= "a" && c <= "z" || c >= "A" && c <= "Z" || c >= "0" && c <= "9" || c == "_" || c == "-") {
      } else {
        return false;
      }
    }
    return true;
  }
  return false;
}

// node_modules/@actions/expressions/dist/errors.js
var MAX_PARSER_DEPTH = 50;
var MAX_EXPRESSION_LENGTH = 21e3;
var ErrorType;
(function(ErrorType2) {
  ErrorType2[ErrorType2["ErrorUnexpectedSymbol"] = 0] = "ErrorUnexpectedSymbol";
  ErrorType2[ErrorType2["ErrorUnrecognizedNamedValue"] = 1] = "ErrorUnrecognizedNamedValue";
  ErrorType2[ErrorType2["ErrorUnexpectedEndOfExpression"] = 2] = "ErrorUnexpectedEndOfExpression";
  ErrorType2[ErrorType2["ErrorExceededMaxDepth"] = 3] = "ErrorExceededMaxDepth";
  ErrorType2[ErrorType2["ErrorExceededMaxLength"] = 4] = "ErrorExceededMaxLength";
  ErrorType2[ErrorType2["ErrorTooFewParameters"] = 5] = "ErrorTooFewParameters";
  ErrorType2[ErrorType2["ErrorTooManyParameters"] = 6] = "ErrorTooManyParameters";
  ErrorType2[ErrorType2["ErrorEvenParameters"] = 7] = "ErrorEvenParameters";
  ErrorType2[ErrorType2["ErrorUnrecognizedContext"] = 8] = "ErrorUnrecognizedContext";
  ErrorType2[ErrorType2["ErrorUnrecognizedFunction"] = 9] = "ErrorUnrecognizedFunction";
})(ErrorType || (ErrorType = {}));
var ExpressionError = class extends Error {
  constructor(typ, tok) {
    super(`${errorDescription(typ)}: '${tokenString(tok)}'`);
    this.typ = typ;
    this.tok = tok;
    this.pos = this.tok.range.start;
  }
};
function errorDescription(typ) {
  switch (typ) {
    case ErrorType.ErrorUnexpectedEndOfExpression:
      return "Unexpected end of expression";
    case ErrorType.ErrorUnexpectedSymbol:
      return "Unexpected symbol";
    case ErrorType.ErrorUnrecognizedNamedValue:
      return "Unrecognized named-value";
    case ErrorType.ErrorExceededMaxDepth:
      return `Exceeded max expression depth ${MAX_PARSER_DEPTH}`;
    case ErrorType.ErrorExceededMaxLength:
      return `Exceeded max expression length ${MAX_EXPRESSION_LENGTH}`;
    case ErrorType.ErrorTooFewParameters:
      return "Too few parameters supplied";
    case ErrorType.ErrorTooManyParameters:
      return "Too many parameters supplied";
    case ErrorType.ErrorEvenParameters:
      return "Even number of parameters supplied, requires an odd number of parameters";
    case ErrorType.ErrorUnrecognizedContext:
      return "Unrecognized named-value";
    case ErrorType.ErrorUnrecognizedFunction:
      return "Unrecognized function";
    default:
      return "Unknown error";
  }
}
var ExpressionEvaluationError = class extends Error {
};

// node_modules/@actions/expressions/dist/funcs/case.js
var caseFunc = {
  name: "case",
  description: "`case( pred1, val1, pred2, val2, ..., default )`\n\nEvaluates predicates in order and returns the value corresponding to the first predicate that evaluates to `true`. If no predicate matches, it returns the last argument as the default value.",
  minArgs: 3,
  maxArgs: Number.MAX_SAFE_INTEGER,
  call: (...args) => {
    for (let i = 0; i < args.length - 1; i += 2) {
      const predicate = args[i];
      if (predicate.kind !== Kind.Boolean) {
        throw new Error("case predicate must evaluate to a boolean value");
      }
      if (predicate.value) {
        return args[i + 1];
      }
    }
    return args[args.length - 1];
  }
};

// node_modules/@actions/expressions/dist/result.js
function coerceTypes(li, ri) {
  let lv = li;
  let rv = ri;
  if (li.kind === ri.kind) {
    return [lv, rv];
  }
  switch (li.kind) {
    // Number, String
    case Kind.Number:
      if (ri.kind === Kind.String) {
        rv = new NumberData(ri.number());
        return [lv, rv];
      }
      break;
    // String, Number
    case Kind.String:
      if (ri.kind === Kind.Number) {
        lv = new NumberData(li.number());
        return [lv, rv];
      }
      break;
    // Boolean|Null, Any
    case Kind.Null:
    case Kind.Boolean:
      lv = new NumberData(li.number());
      return coerceTypes(lv, rv);
  }
  switch (ri.kind) {
    case Kind.Null:
    case Kind.Boolean:
      rv = new NumberData(ri.number());
      return coerceTypes(lv, rv);
  }
  return [lv, rv];
}
function equals(lhs, rhs) {
  const [lv, rv] = coerceTypes(lhs, rhs);
  if (lv.kind != rv.kind) {
    return false;
  }
  switch (lv.kind) {
    // Null, Null
    case Kind.Null:
      return true;
    // Number, Number
    case Kind.Number: {
      const ld = lv.value;
      const rd = rv.value;
      if (isNaN(ld) || isNaN(rd)) {
        return false;
      }
      return ld == rd;
    }
    // String, String
    case Kind.String: {
      const ls = lv.value;
      const rs = rv.value;
      return toUpperSpecial(ls) === toUpperSpecial(rs);
    }
    // Boolean, Boolean
    case Kind.Boolean: {
      const lb = lv.value;
      const rb = rv.value;
      return lb == rb;
    }
    // Object, Object
    case Kind.Dictionary:
    case Kind.Array:
      return lv === rv;
  }
  return false;
}
function toUpperSpecial(s) {
  const sb = [];
  let i = 0;
  const len = s.length;
  let found = s.indexOf("\u0131");
  while (i < len) {
    if (i < found) {
      sb.push(s.substring(i, found).toUpperCase());
      i = found;
    } else if (i == found) {
      sb.push(s.substring(i, i + 1));
      i += 1;
      found = s.indexOf("\u0131", i);
    } else {
      sb.push(s.substring(i).toUpperCase());
      break;
    }
  }
  return sb.join("");
}

// node_modules/@actions/expressions/dist/funcs/contains.js
var contains = {
  name: "contains",
  description: "`contains( search, item )`\n\nReturns `true` if `search` contains `item`. If `search` is an array, this function returns `true` if the `item` is an element in the array. If `search` is a string, this function returns `true` if the `item` is a substring of `search`. This function is not case sensitive. Casts values to a string.",
  minArgs: 2,
  maxArgs: 2,
  call: (...args) => {
    const left = args[0];
    const right = args[1];
    if (left.primitive) {
      const ls = left.coerceString();
      if (right.primitive) {
        const rs = right.coerceString();
        return new BooleanData(ls.toLowerCase().includes(rs.toLowerCase()));
      }
    } else if (left.kind === Kind.Array) {
      const la = left;
      if (la.values().length === 0) {
        return new BooleanData(false);
      }
      for (const v of la.values()) {
        if (equals(right, v)) {
          return new BooleanData(true);
        }
      }
    }
    return new BooleanData(false);
  }
};

// node_modules/@actions/expressions/dist/funcs/endswith.js
var endswith = {
  name: "endsWith",
  description: "`endsWith( searchString, searchValue )`\n\nReturns `true` if `searchString` ends with `searchValue`. This function is not case sensitive. Casts values to a string.",
  minArgs: 2,
  maxArgs: 2,
  call: (...args) => {
    const left = args[0];
    if (!left.primitive) {
      return new BooleanData(false);
    }
    const right = args[1];
    if (!right.primitive) {
      return new BooleanData(false);
    }
    const ls = toUpperSpecial(left.coerceString());
    const rs = toUpperSpecial(right.coerceString());
    return new BooleanData(ls.endsWith(rs));
  }
};

// node_modules/@actions/expressions/dist/funcs/format.js
var format = {
  name: "format",
  description: "`format( string, replaceValue0, replaceValue1, ..., replaceValueN)`\n\nReplaces values in the `string`, with the variable `replaceValueN`. Variables in the `string` are specified using the `{N}` syntax, where `N` is an integer. You must specify at least one `replaceValue` and `string`. There is no maximum for the number of variables (`replaceValueN`) you can use. Escape curly braces using double braces.",
  minArgs: 1,
  maxArgs: 255,
  call: (...args) => {
    const fs = args[0].coerceString();
    const result = [];
    let index = 0;
    while (index < fs.length) {
      const lbrace = fs.indexOf("{", index);
      const rbrace = fs.indexOf("}", index);
      if (lbrace >= 0 && (rbrace < 0 || rbrace > lbrace)) {
        if (safeCharAt(fs, lbrace + 1) === "{") {
          result.push(fs.substr(index, lbrace - index + 1));
          index = lbrace + 2;
          continue;
        }
        if (rbrace > lbrace + 1) {
          const argIndex = readArgIndex(fs, lbrace + 1);
          if (argIndex.success) {
            if (1 + argIndex.result > args.length - 1) {
              throw new Error(`The following format string references more arguments than were supplied: ${fs}`);
            }
            if (lbrace > index) {
              result.push(fs.substr(index, lbrace - index));
            }
            result.push(`${args[1 + argIndex.result].coerceString()}`);
            index = rbrace + 1;
            continue;
          }
        }
        throw new Error(`The following format string is invalid: ${fs}`);
      } else if (rbrace >= 0) {
        if (safeCharAt(fs, rbrace + 1) === "}") {
          result.push(fs.substr(index, rbrace - index + 1));
          index = rbrace + 2;
        } else {
          throw new Error(`The following format string is invalid: ${fs}`);
        }
      } else {
        result.push(fs.substr(index));
        break;
      }
    }
    return new StringData(result.join(""));
  }
};
function safeCharAt(string, index) {
  if (string.length > index) {
    return string[index];
  }
  return "\0";
}
function readArgIndex(string, startIndex) {
  let length = 0;
  for (; ; ) {
    const nextChar = safeCharAt(string, startIndex + length);
    if (nextChar >= "0" && nextChar <= "9") {
      length++;
    } else {
      break;
    }
  }
  if (length < 1) {
    return {
      success: false
    };
  }
  const endIndex = startIndex + length - 1;
  const result = parseInt(string.substr(startIndex, length));
  return {
    success: !isNaN(result),
    result,
    endIndex
  };
}

// node_modules/@actions/expressions/dist/funcs/fromjson.js
var fromjson = {
  name: "fromJson",
  description: "`fromJSON(value)`\n\nReturns a JSON object or JSON data type for `value`. You can use this function to provide a JSON object as an evaluated expression or to convert environment variables from a string.",
  minArgs: 1,
  maxArgs: 1,
  call: (...args) => {
    const input = args[0];
    const is = input.coerceString();
    if (is.trim() === "") {
      throw new Error("empty input");
    }
    try {
      return JSON.parse(is, reviver);
    } catch (e) {
      throw new ExpressionEvaluationError("Error parsing JSON when evaluating fromJson", { cause: e });
    }
  }
};

// node_modules/@actions/expressions/dist/funcs/join.js
var join = {
  name: "join",
  description: "`join( array, optionalSeparator )`\n\nThe value for `array` can be an array or a string. All values in `array` are concatenated into a string. If you provide `optionalSeparator`, it is inserted between the concatenated values. Otherwise, the default separator `,` is used. Casts values to a string.",
  minArgs: 1,
  maxArgs: 2,
  call: (...args) => {
    if (args[0].primitive) {
      return new StringData(args[0].coerceString());
    }
    if (args[0].kind === Kind.Array) {
      let separator = ",";
      if (args.length > 1 && args[1].primitive) {
        separator = args[1].coerceString();
      }
      return new StringData(args[0].values().map((item) => item.coerceString()).join(separator));
    }
    return new StringData("");
  }
};

// node_modules/@actions/expressions/dist/funcs/startswith.js
var startswith = {
  name: "startsWith",
  description: "`startsWith( searchString, searchValue )`\n\nReturns `true` when `searchString` starts with `searchValue`. This function is not case sensitive. Casts values to a string.",
  minArgs: 2,
  maxArgs: 2,
  call: (...args) => {
    const left = args[0];
    if (!left.primitive) {
      return new BooleanData(false);
    }
    const right = args[1];
    if (!right.primitive) {
      return new BooleanData(false);
    }
    const ls = toUpperSpecial(left.coerceString());
    const rs = toUpperSpecial(right.coerceString());
    return new BooleanData(ls.startsWith(rs));
  }
};

// node_modules/@actions/expressions/dist/funcs/tojson.js
var tojson = {
  name: "toJson",
  description: "`toJSON(value)`\n\nReturns a pretty-print JSON representation of `value`. You can use this function to debug the information provided in contexts.",
  minArgs: 1,
  maxArgs: 1,
  call: (...args) => {
    return new StringData(JSON.stringify(args[0], replacer, "  "));
  }
};

// node_modules/@actions/expressions/dist/funcs.js
var wellKnownFunctions = {
  case: caseFunc,
  contains,
  endswith,
  format,
  fromjson,
  join,
  startswith,
  tojson
};
function validateFunction(context, identifier, argCount) {
  const name2 = identifier.lexeme.toLowerCase();
  let f;
  f = wellKnownFunctions[name2];
  if (!f) {
    f = context.extensionFunctions.get(name2);
    if (!f) {
      if (!context.allowUnknownKeywords) {
        throw new ExpressionError(ErrorType.ErrorUnrecognizedFunction, identifier);
      }
      return;
    }
  }
  if (argCount < f.minArgs) {
    throw new ExpressionError(ErrorType.ErrorTooFewParameters, identifier);
  }
  if (argCount > f.maxArgs) {
    throw new ExpressionError(ErrorType.ErrorTooManyParameters, identifier);
  }
  if (name2 === "case" && argCount % 2 === 0) {
    throw new ExpressionError(ErrorType.ErrorEvenParameters, identifier);
  }
}

// node_modules/@actions/expressions/dist/features.js
var allFeatureKeys = [
  "missingInputsQuickfix",
  "blockScalarChompingWarning",
  "allowCaseFunction",
  "allowCopilotRequestsPermission",
  "allowDrivesPermissionAutocomplete",
  "allowBackgroundSteps"
];
var FeatureFlags = class {
  constructor(features) {
    this.features = features ?? {};
  }
  /**
   * Check if an experimental feature is enabled.
   *
   * Resolution order:
   * 1. Explicit feature flag (if set)
   * 2. `all` flag (if set)
   * 3. false (default)
   */
  isEnabled(feature) {
    const explicit = this.features[feature];
    if (explicit !== void 0) {
      return explicit;
    }
    return this.features.all ?? false;
  }
  /**
   * Returns list of all enabled experimental features.
   */
  getEnabledFeatures() {
    return allFeatureKeys.filter((key) => this.isEnabled(key));
  }
};

// node_modules/@actions/expressions/dist/parser.js
var Parser = class {
  /**
   * Constructs a new parser for the given tokens
   *
   * @param tokens Tokens to build a parse tree from
   * @param extensionContexts Available context names
   * @param extensionFunctions Available functions (beyond the built-in ones)
   */
  constructor(tokens, extensionContexts, extensionFunctions) {
    this.tokens = tokens;
    this.offset = 0;
    this.depth = 0;
    this.extContexts = /* @__PURE__ */ new Map();
    this.extFuncs = /* @__PURE__ */ new Map();
    for (const contextName of extensionContexts) {
      this.extContexts.set(contextName.toLowerCase(), true);
    }
    for (const { name: name2, func } of extensionFunctions.map((x) => ({
      name: x.name,
      func: x
    }))) {
      this.extFuncs.set(name2.toLowerCase(), func);
    }
    this.context = {
      allowUnknownKeywords: false,
      extensionContexts: this.extContexts,
      extensionFunctions: this.extFuncs
    };
  }
  parse() {
    let result;
    if (this.atEnd()) {
      return result;
    }
    result = this.expression();
    if (!this.atEnd()) {
      throw this.buildError(ErrorType.ErrorUnexpectedSymbol, this.peek());
    }
    return result;
  }
  expression() {
    this.incrDepth();
    try {
      return this.logicalOr();
    } finally {
      this.decrDepth();
    }
  }
  logicalOr() {
    let expr = this.logicalAnd();
    if (this.check(TokenType.OR)) {
      this.incrDepth();
      try {
        const logical = new Logical(this.peek(), [expr]);
        expr = logical;
        while (this.match(TokenType.OR)) {
          const right = this.logicalAnd();
          logical.args.push(right);
        }
      } finally {
        this.decrDepth();
      }
    }
    return expr;
  }
  logicalAnd() {
    let expr = this.equality();
    if (this.check(TokenType.AND)) {
      this.incrDepth();
      try {
        const logical = new Logical(this.peek(), [expr]);
        expr = logical;
        while (this.match(TokenType.AND)) {
          const right = this.equality();
          logical.args.push(right);
        }
      } finally {
        this.decrDepth();
      }
    }
    return expr;
  }
  equality() {
    let expr = this.comparison();
    while (this.match(TokenType.BANG_EQUAL, TokenType.EQUAL_EQUAL)) {
      const operator = this.previous();
      const right = this.comparison();
      expr = new Binary(expr, operator, right);
    }
    return expr;
  }
  comparison() {
    let expr = this.unary();
    while (this.match(TokenType.GREATER, TokenType.GREATER_EQUAL, TokenType.LESS, TokenType.LESS_EQUAL)) {
      const operator = this.previous();
      const right = this.unary();
      expr = new Binary(expr, operator, right);
    }
    return expr;
  }
  unary() {
    if (this.match(TokenType.BANG)) {
      this.incrDepth();
      const operator = this.previous();
      const unary = this.unary();
      try {
        return new Unary(operator, unary);
      } finally {
        this.decrDepth();
      }
    }
    return this.index();
  }
  index() {
    let expr = this.call();
    let depthIncreased = 0;
    if (expr instanceof Grouping || expr instanceof FunctionCall || expr instanceof ContextAccess) {
      let cont = true;
      while (cont) {
        switch (true) {
          case this.match(TokenType.LEFT_BRACKET): {
            let indexExpr;
            if (this.match(TokenType.STAR)) {
              indexExpr = new Star();
            } else {
              indexExpr = this.expression();
            }
            this.consume(TokenType.RIGHT_BRACKET, ErrorType.ErrorUnexpectedSymbol);
            this.incrDepth();
            depthIncreased++;
            expr = new IndexAccess(expr, indexExpr);
            break;
          }
          case this.match(TokenType.DOT):
            this.incrDepth();
            depthIncreased++;
            if (this.match(TokenType.IDENTIFIER)) {
              const property = this.previous();
              expr = new IndexAccess(expr, new Literal(new StringData(property.lexeme), property));
            } else if (this.match(TokenType.STAR)) {
              expr = new IndexAccess(expr, new Star());
            } else {
              throw this.buildError(ErrorType.ErrorUnexpectedSymbol, this.peek());
            }
            break;
          default:
            cont = false;
        }
      }
    }
    for (let i = 0; i < depthIncreased; i++) {
      this.decrDepth();
    }
    return expr;
  }
  call() {
    if (!this.check(TokenType.IDENTIFIER)) {
      return this.primary();
    }
    const identifier = this.next();
    if (!this.match(TokenType.LEFT_PAREN)) {
      if (!this.extContexts.has(identifier.lexeme.toLowerCase())) {
        throw this.buildError(ErrorType.ErrorUnrecognizedContext, identifier);
      }
      return new ContextAccess(identifier);
    }
    const args = [];
    while (!this.match(TokenType.RIGHT_PAREN)) {
      const aexp = this.expression();
      args.push(aexp);
      if (!this.check(TokenType.RIGHT_PAREN)) {
        this.consume(TokenType.COMMA, ErrorType.ErrorUnexpectedSymbol);
      }
    }
    validateFunction(this.context, identifier, args.length);
    return new FunctionCall(identifier, args);
  }
  primary() {
    switch (true) {
      case this.match(TokenType.FALSE):
        return new Literal(new BooleanData(false), this.previous());
      case this.match(TokenType.TRUE):
        return new Literal(new BooleanData(true), this.previous());
      case this.match(TokenType.NULL):
        return new Literal(new Null(), this.previous());
      case this.match(TokenType.NUMBER):
        return new Literal(new NumberData(this.previous().value), this.previous());
      case this.match(TokenType.STRING):
        return new Literal(new StringData(this.previous().value), this.previous());
      case this.match(TokenType.LEFT_PAREN): {
        const expr = this.expression();
        if (this.atEnd()) {
          throw this.buildError(ErrorType.ErrorUnexpectedEndOfExpression, this.previous());
        }
        this.consume(TokenType.RIGHT_PAREN, ErrorType.ErrorUnexpectedSymbol);
        return new Grouping(expr);
      }
      case this.atEnd():
        throw this.buildError(ErrorType.ErrorUnexpectedEndOfExpression, this.previous());
    }
    throw this.buildError(ErrorType.ErrorUnexpectedSymbol, this.peek());
  }
  // match consumes the next token if it matches any of the given types
  match(...tokenTypes) {
    for (const tokenType of tokenTypes) {
      if (this.check(tokenType)) {
        this.next();
        return true;
      }
    }
    return false;
  }
  // check peeks whether the next token is of the given type
  check(tokenType) {
    if (this.atEnd()) {
      return false;
    }
    return this.peek().type == tokenType;
  }
  // atEnd peeks whether the next token is EOF
  atEnd() {
    return this.peek().type == TokenType.EOF;
  }
  next() {
    if (!this.atEnd()) {
      this.offset++;
    }
    return this.previous();
  }
  peek() {
    return this.tokens[this.offset];
  }
  // previous returns the previous token
  previous() {
    return this.tokens[this.offset - 1];
  }
  // consume attempts to consume the next token if it matches the given type. It returns an error of
  // the given ParseErrorKind otherwise.
  consume(tokenType, errorType) {
    if (this.check(tokenType)) {
      this.next();
      return;
    }
    throw this.buildError(errorType, this.peek());
  }
  incrDepth() {
    this.depth++;
    if (this.depth > MAX_PARSER_DEPTH) {
      throw this.buildError(ErrorType.ErrorExceededMaxDepth, this.peek());
    }
  }
  decrDepth() {
    this.depth--;
  }
  buildError(errType, token) {
    return new ExpressionError(errType, token);
  }
};

// node_modules/@actions/workflow-parser/dist/templates/tokens/types.js
var TokenType2;
(function(TokenType3) {
  TokenType3[TokenType3["String"] = 0] = "String";
  TokenType3[TokenType3["Sequence"] = 1] = "Sequence";
  TokenType3[TokenType3["Mapping"] = 2] = "Mapping";
  TokenType3[TokenType3["BasicExpression"] = 3] = "BasicExpression";
  TokenType3[TokenType3["InsertExpression"] = 4] = "InsertExpression";
  TokenType3[TokenType3["Boolean"] = 5] = "Boolean";
  TokenType3[TokenType3["Number"] = 6] = "Number";
  TokenType3[TokenType3["Null"] = 7] = "Null";
})(TokenType2 || (TokenType2 = {}));
function tokenTypeName(type) {
  switch (type) {
    case TokenType2.String:
      return "StringToken";
    case TokenType2.Sequence:
      return "SequenceToken";
    case TokenType2.Mapping:
      return "MappingToken";
    case TokenType2.BasicExpression:
      return "BasicExpressionToken";
    case TokenType2.InsertExpression:
      return "InsertExpressionToken";
    case TokenType2.Boolean:
      return "BooleanToken";
    case TokenType2.Number:
      return "NumberToken";
    case TokenType2.Null:
      return "NullToken";
    default: {
      const exhaustiveCheck = type;
      throw new Error(`Unhandled token type: ${type} ${exhaustiveCheck}}`);
    }
  }
}

// node_modules/@actions/workflow-parser/dist/templates/tokens/traversal-state.js
var TraversalState = class {
  constructor(parent, token) {
    this.index = -1;
    this.isKey = false;
    this.parent = parent;
    this._token = token;
    this.current = token;
  }
  moveNext(omitKeys) {
    switch (this._token.templateTokenType) {
      case TokenType2.Sequence: {
        const sequence = this._token;
        if (++this.index < sequence.count) {
          this.current = sequence.get(this.index);
          return true;
        }
        this.current = void 0;
        return false;
      }
      case TokenType2.Mapping: {
        const mapping = this._token;
        if (this.isKey) {
          this.isKey = false;
          this.currentKey = this.current;
          this.current = mapping.get(this.index).value;
          return true;
        }
        if (++this.index < mapping.count) {
          if (omitKeys) {
            this.isKey = false;
            this.currentKey = mapping.get(this.index).key;
            this.current = mapping.get(this.index).value;
            return true;
          }
          this.isKey = true;
          this.currentKey = void 0;
          this.current = mapping.get(this.index).key;
          return true;
        }
        this.currentKey = void 0;
        this.current = void 0;
        return false;
      }
      default:
        throw new Error(`Unexpected token type '${this._token.templateTokenType}' when traversing state`);
    }
  }
  /**
   * Returns the ancestor tokens from root to the current token's parent container.
   */
  getAncestors() {
    const ancestors = [];
    let state = this.parent;
    while (state) {
      if (state.current) {
        ancestors.unshift(state.current);
      }
      state = state.parent;
    }
    return ancestors;
  }
};

// node_modules/@actions/workflow-parser/dist/templates/tokens/template-token.js
var TemplateTokenError = class extends Error {
  constructor(message, token) {
    super(message);
    this.token = token;
  }
};
var TemplateToken = class {
  /**
   * Base class for all template tokens
   */
  constructor(type, file, range, definitionInfo) {
    this.type = type;
    this.file = file;
    this.range = range;
    this.definitionInfo = definitionInfo;
  }
  get templateTokenType() {
    return this.type;
  }
  get line() {
    return this.range?.start.line;
  }
  get col() {
    return this.range?.start.column;
  }
  get definition() {
    return this.definitionInfo?.definition;
  }
  get description() {
    return this._description || this.propertyDefinition?.description || this.definition?.description;
  }
  set description(description) {
    this._description = description;
  }
  typeName() {
    return tokenTypeName(this.type);
  }
  /**
   * Asserts expected type and throws a good debug message if unexpected
   */
  assertNull(objectDescription) {
    if (this.type === TokenType2.Null) {
      return this;
    }
    throw new TemplateTokenError(`Unexpected type '${this.typeName()}' encountered while reading '${objectDescription}'. The type '${tokenTypeName(TokenType2.Null)}' was expected.`, this);
  }
  /**
   * Asserts expected type and throws a good debug message if unexpected
   */
  assertBoolean(objectDescription) {
    if (this.type === TokenType2.Boolean) {
      return this;
    }
    throw new TemplateTokenError(`Unexpected type '${this.typeName()}' encountered while reading '${objectDescription}'. The type '${tokenTypeName(TokenType2.Boolean)}' was expected.`, this);
  }
  /**
   * Asserts expected type and throws a good debug message if unexpected
   */
  assertNumber(objectDescription) {
    if (this.type === TokenType2.Number) {
      return this;
    }
    throw new TemplateTokenError(`Unexpected type '${this.typeName()}' encountered while reading '${objectDescription}'. The type '${tokenTypeName(TokenType2.Number)}' was expected.`, this);
  }
  /**
   * Asserts expected type and throws a good debug message if unexpected
   */
  assertString(objectDescription) {
    if (this.type === TokenType2.String) {
      return this;
    }
    throw new TemplateTokenError(`Unexpected type '${this.typeName()}' encountered while reading '${objectDescription}'. The type '${tokenTypeName(TokenType2.String)}' was expected.`, this);
  }
  /**
   * Asserts expected type and throws a good debug message if unexpected
   */
  assertScalar(objectDescription) {
    if (this?.isScalar === true) {
      return this;
    }
    throw new TemplateTokenError(`Unexpected type '${this.typeName()}' encountered while reading '${objectDescription}'. The type 'ScalarToken' was expected.`, this);
  }
  /**
   * Asserts expected type and throws a good debug message if unexpected
   */
  assertSequence(objectDescription) {
    if (this.type === TokenType2.Sequence) {
      return this;
    }
    throw new TemplateTokenError(`Unexpected type '${this.typeName()}' encountered while reading '${objectDescription}'. The type '${tokenTypeName(TokenType2.Sequence)}' was expected.`, this);
  }
  /**
   * Asserts expected type and throws a good debug message if unexpected
   */
  assertMapping(objectDescription) {
    if (this.type === TokenType2.Mapping) {
      return this;
    }
    throw new TemplateTokenError(`Unexpected type '${this.typeName()}' encountered while reading '${objectDescription}'. The type '${tokenTypeName(TokenType2.Mapping)}' was expected.`, this);
  }
  /**
   * Returns all tokens (depth first)
   * @param value The object to traverse
   * @param omitKeys Whether to omit mapping keys
   * @yields A tuple of [parent, token, keyToken, ancestors] for each token in the tree
   */
  static *traverse(value, omitKeys) {
    yield [void 0, value, void 0, []];
    switch (value.templateTokenType) {
      case TokenType2.Sequence:
      case TokenType2.Mapping: {
        let state = new TraversalState(void 0, value);
        state = new TraversalState(state, value);
        while (state.parent) {
          if (state.moveNext(omitKeys ?? false)) {
            value = state.current;
            yield [state.parent?.current, value, state.currentKey, state.getAncestors()];
            switch (value.type) {
              case TokenType2.Sequence:
              case TokenType2.Mapping:
                state = new TraversalState(state, value);
                break;
            }
          } else {
            state = state.parent;
          }
        }
        break;
      }
    }
  }
  toJSON() {
    return void 0;
  }
};

// node_modules/@actions/workflow-parser/dist/templates/template-validation-error.js
var TemplateValidationError = class {
  constructor(rawMessage, prefix, code, range) {
    this.rawMessage = rawMessage;
    this.prefix = prefix;
    this.code = code;
    this.range = range;
  }
  get message() {
    if (this.prefix) {
      return `${this.prefix}: ${this.rawMessage}`;
    }
    return this.rawMessage;
  }
  toString() {
    return this.message;
  }
};

// node_modules/@actions/workflow-parser/dist/templates/template-context.js
var TemplateContext = class {
  constructor(errors, schema2, trace) {
    this._fileIds = {};
    this._fileNames = [];
    this.expressionFunctions = [];
    this.expressionNamedContexts = [];
    this.state = {};
    this.errors = errors;
    this.schema = schema2;
    this.trace = trace;
  }
  error(tokenOrFileId, err, tokenRange) {
    const token = tokenOrFileId;
    const range = tokenRange || token?.range;
    const prefix = this.getErrorPrefix(token?.file ?? tokenOrFileId, token?.line, token?.col);
    const message = err?.message ?? String(err);
    const e = new TemplateValidationError(message, prefix, void 0, range);
    this.errors.add(e);
    this.trace.error(e.message);
  }
  /**
   * Gets or adds the file ID
   */
  getFileId(file) {
    const key = file.toUpperCase();
    let id = this._fileIds[key];
    if (id === void 0) {
      id = this._fileNames.length + 1;
      this._fileIds[key] = id;
      this._fileNames.push(file);
    }
    return id;
  }
  /**
   * Looks up a file name by ID. Returns undefined if not found.
   */
  getFileName(fileId) {
    return this._fileNames.length >= fileId ? this._fileNames[fileId - 1] : void 0;
  }
  /**
   * Gets a copy of the file table
   */
  getFileTable() {
    return this._fileNames.slice();
  }
  getErrorPrefix(fileId, line, column) {
    const fileName = fileId !== void 0 ? this.getFileName(fileId) : void 0;
    if (fileName) {
      if (line !== void 0 && column !== void 0) {
        return `${fileName} (Line: ${line}, Col: ${column})`;
      } else {
        return fileName;
      }
    } else if (line !== void 0 && column !== void 0) {
      return `(Line: ${line}, Col: ${column})`;
    } else {
      return "";
    }
  }
};
var TemplateValidationErrors = class {
  constructor(maxErrors, maxMessageLength) {
    this._errors = [];
    this._maxErrors = maxErrors ?? 0;
    this._maxMessageLength = maxMessageLength ?? 0;
  }
  get count() {
    return this._errors.length;
  }
  add(err) {
    for (let e of Array.isArray(err) ? err : [err]) {
      if (this._maxErrors <= 0 || this._errors.length < this._maxErrors) {
        if (this._maxMessageLength > 0 && e.message.length > this._maxMessageLength) {
          e = new TemplateValidationError(e.message.substring(0, this._maxMessageLength) + "[...]", e.prefix, e.code, e.range);
        }
        this._errors.push(e);
      }
    }
  }
  /**
   * Throws if any errors
   * @param prefix The error message prefix
   */
  check(prefix) {
    if (this._errors.length <= 0) {
      return;
    }
    if (!prefix) {
      prefix = "The template is not valid.";
    }
    throw new Error(`${prefix} ${this._errors.map((x) => x.message).join(",")}`);
  }
  clear() {
    this._errors = [];
  }
  getErrors() {
    return this._errors.slice();
  }
};

// node_modules/@actions/workflow-parser/dist/templates/schema/definition-info.js
var DefinitionInfo = class {
  constructor(schemaOrParent, nameOrDefinition) {
    this.isDefinitionInfo = true;
    const parent = schemaOrParent?.isDefinitionInfo === true ? schemaOrParent : void 0;
    this._schema = parent === void 0 ? schemaOrParent : parent._schema;
    this.definition = typeof nameOrDefinition === "string" ? this._schema.getDefinition(nameOrDefinition) : nameOrDefinition;
    if (this.definition.readerContext.length > 0) {
      this.allowedContext = [];
      const upperSeen = {};
      for (const context of parent?.allowedContext ?? []) {
        this.allowedContext.push(context);
        upperSeen[context.toUpperCase()] = true;
      }
      for (const context of this.definition.readerContext) {
        const upper = context.toUpperCase();
        if (!upperSeen[upper]) {
          this.allowedContext.push(context);
          upperSeen[upper] = true;
        }
      }
    } else {
      this.allowedContext = parent?.allowedContext ?? [];
    }
  }
  getScalarDefinitions() {
    return this._schema.getScalarDefinitions(this.definition);
  }
  getDefinitionsOfType(type) {
    return this._schema.getDefinitionsOfType(this.definition, type);
  }
};

// node_modules/@actions/workflow-parser/dist/templates/schema/definition-type.js
var DefinitionType;
(function(DefinitionType2) {
  DefinitionType2[DefinitionType2["Null"] = 0] = "Null";
  DefinitionType2[DefinitionType2["Boolean"] = 1] = "Boolean";
  DefinitionType2[DefinitionType2["Number"] = 2] = "Number";
  DefinitionType2[DefinitionType2["String"] = 3] = "String";
  DefinitionType2[DefinitionType2["Sequence"] = 4] = "Sequence";
  DefinitionType2[DefinitionType2["Mapping"] = 5] = "Mapping";
  DefinitionType2[DefinitionType2["OneOf"] = 6] = "OneOf";
  DefinitionType2[DefinitionType2["AllowedValues"] = 7] = "AllowedValues";
})(DefinitionType || (DefinitionType = {}));

// node_modules/@actions/workflow-parser/dist/templates/template-constants.js
var ALLOWED_VALUES = "allowed-values";
var ANY = "any";
var BOOLEAN = "boolean";
var BOOLEAN_DEFINITION = "boolean-definition";
var BOOLEAN_DEFINITION_PROPERTIES = "boolean-definition-properties";
var CLOSE_EXPRESSION = "}}";
var CONSTANT = "constant";
var CONTEXT = "context";
var DEFINITION = "definition";
var DEFINITIONS = "definitions";
var DESCRIPTION = "description";
var IGNORE_CASE = "ignore-case";
var INSERT_DIRECTIVE = "insert";
var IS_EXPRESSION = "is-expression";
var ITEM_TYPE = "item-type";
var LOOSE_KEY_TYPE = "loose-key-type";
var LOOSE_VALUE_TYPE = "loose-value-type";
var MAX_CONSTANT = "MAX";
var MAPPING = "mapping";
var MAPPING_DEFINITION = "mapping-definition";
var MAPPING_DEFINITION_PROPERTIES = "mapping-definition-properties";
var MAPPING_PROPERTY_VALUE = "mapping-property-value";
var NON_EMPTY_STRING = "non-empty-string";
var NULL = "null";
var NULL_DEFINITION = "null-definition";
var NULL_DEFINITION_PROPERTIES = "null-definition-properties";
var NUMBER = "number";
var NUMBER_DEFINITION = "number-definition";
var NUMBER_DEFINITION_PROPERTIES = "number-definition-properties";
var ONE_OF = "one-of";
var ONE_OF_DEFINITION = "one-of-definition";
var OPEN_EXPRESSION = "${{";
var PROPERTY_VALUE = "property-value";
var PROPERTIES = "properties";
var REQUIRED = "required";
var REQUIRE_NON_EMPTY = "require-non-empty";
var SCALAR = "scalar";
var SEQUENCE = "sequence";
var SEQUENCE_DEFINITION = "sequence-definition";
var SEQUENCE_DEFINITION_PROPERTIES = "sequence-definition-properties";
var TYPE = "type";
var SEQUENCE_OF_NON_EMPTY_STRING = "sequence-of-non-empty-string";
var STRING = "string";
var STRING_DEFINITION = "string-definition";
var STRING_DEFINITION_PROPERTIES = "string-definition-properties";
var TEMPLATE_SCHEMA = "template-schema";
var VERSION = "version";

// node_modules/@actions/workflow-parser/dist/templates/tokens/scalar-token.js
var ScalarToken = class extends TemplateToken {
  constructor(type, file, range, definitionInfo) {
    super(type, file, range, definitionInfo);
  }
  get isScalar() {
    return true;
  }
  static trimDisplayString(displayString) {
    let firstLine = displayString.trimStart();
    const firstNewLine = firstLine.indexOf("\n");
    const firstCarriageReturn = firstLine.indexOf("\r");
    if (firstNewLine >= 0 || firstCarriageReturn >= 0) {
      firstLine = firstLine.substr(0, Math.min(firstNewLine >= 0 ? firstNewLine : Number.MAX_VALUE, firstCarriageReturn >= 0 ? firstCarriageReturn : Number.MAX_VALUE));
    }
    return firstLine;
  }
};

// node_modules/@actions/workflow-parser/dist/templates/tokens/literal-token.js
var LiteralToken = class extends ScalarToken {
  constructor(type, file, range, definitionInfo) {
    super(type, file, range, definitionInfo);
  }
  get isLiteral() {
    return true;
  }
  get isExpression() {
    return false;
  }
  toDisplayString() {
    return ScalarToken.trimDisplayString(this.toString());
  }
  /**
   * Throws a good debug message when an unexpected literal value is encountered
   */
  assertUnexpectedValue(objectDescription) {
    throw new Error(`Error while reading '${objectDescription}'. Unexpected value '${this.toString()}'`);
  }
};

// node_modules/@actions/workflow-parser/dist/templates/tokens/string-token.js
var StringToken = class _StringToken extends LiteralToken {
  constructor(file, range, value, definitionInfo, source, blockScalarHeader) {
    super(TokenType2.String, file, range, definitionInfo);
    this.value = value;
    this.source = source;
    this.blockScalarHeader = blockScalarHeader;
  }
  clone(omitSource) {
    return omitSource ? new _StringToken(void 0, void 0, this.value, this.definitionInfo, this.source, this.blockScalarHeader) : new _StringToken(this.file, this.range, this.value, this.definitionInfo, this.source, this.blockScalarHeader);
  }
  toString() {
    return this.value;
  }
  toJSON() {
    return this.value;
  }
};

// node_modules/@actions/workflow-parser/dist/templates/tokens/number-token.js
var NumberToken = class _NumberToken extends LiteralToken {
  constructor(file, range, value, definitionInfo) {
    super(TokenType2.Number, file, range, definitionInfo);
    this.num = value;
  }
  get value() {
    return this.num;
  }
  clone(omitSource) {
    return omitSource ? new _NumberToken(void 0, void 0, this.num, this.definitionInfo) : new _NumberToken(this.file, this.range, this.num, this.definitionInfo);
  }
  toString() {
    return `${this.num}`;
  }
  toJSON() {
    return this.num;
  }
};

// node_modules/@actions/workflow-parser/dist/templates/tokens/boolean-token.js
var BooleanToken = class _BooleanToken extends LiteralToken {
  constructor(file, range, value, definitionInfo) {
    super(TokenType2.Boolean, file, range, definitionInfo);
    this.bool = value;
  }
  get value() {
    return this.bool;
  }
  clone(omitSource) {
    return omitSource ? new _BooleanToken(void 0, void 0, this.bool, this.definitionInfo) : new _BooleanToken(this.file, this.range, this.bool, this.definitionInfo);
  }
  toString() {
    return this.bool ? "true" : "false";
  }
  toJSON() {
    return this.bool;
  }
};

// node_modules/@actions/workflow-parser/dist/templates/tokens/null-token.js
var NullToken = class _NullToken extends LiteralToken {
  constructor(file, range, definitionInfo) {
    super(TokenType2.Null, file, range, definitionInfo);
  }
  clone(omitSource) {
    return omitSource ? new _NullToken(void 0, void 0, this.definitionInfo) : new _NullToken(this.file, this.range, this.definitionInfo);
  }
  toString() {
    return "";
  }
  toJSON() {
    return null;
  }
};

// node_modules/@actions/workflow-parser/dist/templates/tokens/key-value-pair.js
var KeyValuePair = class {
  constructor(key, value) {
    this.key = key;
    this.value = value;
  }
};

// node_modules/@actions/workflow-parser/dist/templates/tokens/sequence-token.js
var SequenceToken = class _SequenceToken extends TemplateToken {
  constructor(file, range, definitionInfo) {
    super(TokenType2.Sequence, file, range, definitionInfo);
    this.seq = [];
  }
  get count() {
    return this.seq.length;
  }
  get isScalar() {
    return false;
  }
  get isLiteral() {
    return false;
  }
  get isExpression() {
    return false;
  }
  add(value) {
    this.seq.push(value);
  }
  get(index) {
    return this.seq[index];
  }
  clone(omitSource) {
    const result = omitSource ? new _SequenceToken(void 0, void 0, this.definitionInfo) : new _SequenceToken(this.file, this.range, this.definitionInfo);
    for (const item of this.seq) {
      result.add(item.clone(omitSource));
    }
    return result;
  }
  toJSON() {
    return {
      type: TokenType2.Sequence,
      seq: this.seq
    };
  }
  *[Symbol.iterator]() {
    for (const item of this.seq) {
      yield item;
    }
  }
};

// node_modules/@actions/workflow-parser/dist/templates/tokens/mapping-token.js
var MappingToken = class _MappingToken extends TemplateToken {
  constructor(file, range, definitionInfo) {
    super(TokenType2.Mapping, file, range, definitionInfo);
    this.map = [];
  }
  get count() {
    return this.map.length;
  }
  get isScalar() {
    return false;
  }
  get isLiteral() {
    return false;
  }
  get isExpression() {
    return false;
  }
  add(key, value) {
    this.map.push(new KeyValuePair(key, value));
  }
  get(index) {
    return this.map[index];
  }
  find(key) {
    const pair = this.map.find((pair2) => pair2.key.toString() === key);
    return pair?.value;
  }
  remove(index) {
    this.map.splice(index, 1);
  }
  clone(omitSource) {
    const result = omitSource ? new _MappingToken(void 0, void 0, this.definitionInfo) : new _MappingToken(this.file, this.range, this.definitionInfo);
    for (const item of this.map) {
      result.add(item.key.clone(omitSource), item.value.clone(omitSource));
    }
    return result;
  }
  toJSON() {
    const items = [];
    for (const item of this.map) {
      items.push({ Key: item.key, Value: item.value });
    }
    return {
      type: TokenType2.Mapping,
      map: items
    };
  }
  *[Symbol.iterator]() {
    for (const item of this.map) {
      yield item;
    }
  }
};

// node_modules/@actions/workflow-parser/dist/templates/allowed-context.js
function splitAllowedContext(allowedContext) {
  const FUNCTION_REGEXP = /^([a-zA-Z0-9_]+)\(([0-9]+),([0-9]+|MAX)\)$/;
  const namedContexts = [];
  const functions = [];
  if (allowedContext.length > 0) {
    for (const contextItem of allowedContext) {
      const match = contextItem.match(FUNCTION_REGEXP);
      if (match) {
        const functionName = match[1];
        const minParameters = Number.parseInt(match[2]);
        const maxParametersRaw = match[3];
        const maxParameters = maxParametersRaw === MAX_CONSTANT ? Number.MAX_SAFE_INTEGER : Number.parseInt(maxParametersRaw);
        functions.push({
          name: functionName,
          minArgs: minParameters,
          maxArgs: maxParameters
        });
      } else {
        namedContexts.push(contextItem);
      }
    }
  }
  return {
    namedContexts,
    functions
  };
}

// node_modules/@actions/workflow-parser/dist/templates/tokens/expression-token.js
var ExpressionToken = class extends ScalarToken {
  constructor(type, file, range, directive, definitionInfo) {
    super(type, file, range, definitionInfo);
    this.directive = directive;
  }
  get isLiteral() {
    return false;
  }
  get isExpression() {
    return true;
  }
  static validateExpression(expression, allowedContext) {
    const { namedContexts, functions } = splitAllowedContext(allowedContext);
    const lexer = new Lexer(expression);
    const result = lexer.lex();
    const p = new Parser(result.tokens, namedContexts, functions);
    p.parse();
  }
};

// node_modules/@actions/workflow-parser/dist/templates/tokens/basic-expression-token.js
var BasicExpressionToken = class _BasicExpressionToken extends ExpressionToken {
  /**
   * @param file The file ID where this token originated
   * @param range The range of the entire expression including `${{` and `}}`
   * @param expression The expression string without `${{` and `}}` markers
   * @param definitionInfo Schema definition info for this token
   * @param originalExpressions If transformed from individual expressions (e.g., format()), these are the originals
   * @param source The original source string from the YAML
   * @param expressionRange The range of just the expression, excluding `${{` and `}}`
   * @param blockScalarHeader The block scalar header (e.g., "|", "|-") if parsed from a YAML block scalar
   */
  constructor(file, range, expression, definitionInfo, originalExpressions, source, expressionRange, blockScalarHeader) {
    super(TokenType2.BasicExpression, file, range, void 0, definitionInfo);
    this.expr = expression;
    this.source = source;
    this.originalExpressions = originalExpressions;
    this.expressionRange = expressionRange;
    this.blockScalarHeader = blockScalarHeader;
  }
  get expression() {
    return this.expr;
  }
  clone(omitSource) {
    return omitSource ? new _BasicExpressionToken(void 0, void 0, this.expr, this.definitionInfo, this.originalExpressions, this.source, this.expressionRange, this.blockScalarHeader) : new _BasicExpressionToken(this.file, this.range, this.expr, this.definitionInfo, this.originalExpressions, this.source, this.expressionRange, this.blockScalarHeader);
  }
  toString() {
    return `${OPEN_EXPRESSION} ${this.expr} ${CLOSE_EXPRESSION}`;
  }
  toDisplayString() {
    return ScalarToken.trimDisplayString(this.toString());
  }
  toJSON() {
    return {
      type: TokenType2.BasicExpression,
      expr: this.expr
    };
  }
};

// node_modules/@actions/workflow-parser/dist/templates/tokens/insert-expression-token.js
var InsertExpressionToken = class _InsertExpressionToken extends ExpressionToken {
  constructor(file, range, definitionInfo) {
    super(TokenType2.InsertExpression, file, range, INSERT_DIRECTIVE, definitionInfo);
  }
  clone(omitSource) {
    return omitSource ? new _InsertExpressionToken(void 0, void 0, this.definitionInfo) : new _InsertExpressionToken(this.file, this.range, this.definitionInfo);
  }
  toString() {
    return `${OPEN_EXPRESSION} ${INSERT_DIRECTIVE} ${CLOSE_EXPRESSION}`;
  }
  toDisplayString() {
    return ScalarToken.trimDisplayString(this.toString());
  }
  toJSON() {
    return {
      type: TokenType2.InsertExpression,
      expr: "insert"
    };
  }
};

// node_modules/@actions/workflow-parser/dist/templates/tokens/type-guards.js
function isLiteral(t) {
  return t.isLiteral;
}
function isScalar(t) {
  return t.isScalar;
}
function isString(t) {
  return isLiteral(t) && t.templateTokenType === TokenType2.String;
}
function isSequence(t) {
  return t instanceof SequenceToken;
}
function isMapping(t) {
  return t instanceof MappingToken;
}

// node_modules/@actions/workflow-parser/dist/templates/template-reader.js
var WHITESPACE_PATTERN = /\s/;
var backgroundStepProperties = /* @__PURE__ */ new Set(["background", "wait", "wait-all", "cancel"]);
var backgroundStepOnlyProperties = /* @__PURE__ */ new Set(["wait", "wait-all", "cancel"]);
function readTemplate(context, type, objectReader, fileId) {
  const reader = new TemplateReader(context, objectReader, fileId);
  let value;
  try {
    objectReader.validateStart();
    const definition = new DefinitionInfo(context.schema, type);
    value = reader.readValue(definition);
    objectReader.validateEnd();
  } catch (err) {
    context.error(fileId, err);
  }
  return value;
}
var TemplateReader = class {
  constructor(context, objectReader, fileId) {
    this._context = context;
    this._schema = context.schema;
    this._objectReader = objectReader;
    this._fileId = fileId;
  }
  readValue(definition) {
    const literal = this._objectReader.allowLiteral();
    if (literal) {
      let scalar = this.parseScalar(literal, definition);
      scalar = this.validate(scalar, definition);
      return scalar;
    }
    const sequence = this._objectReader.allowSequenceStart();
    if (sequence) {
      const sequenceDefinition = definition.getDefinitionsOfType(DefinitionType.Sequence)[0];
      if (sequenceDefinition) {
        const itemDefinition = new DefinitionInfo(definition, sequenceDefinition.itemType);
        while (!this._objectReader.allowSequenceEnd()) {
          const item = this.readValue(itemDefinition);
          sequence.add(item);
        }
      } else {
        this._context.error(sequence, "A sequence was not expected");
        while (!this._objectReader.allowSequenceEnd()) {
          this.skipValue();
        }
      }
      sequence.definitionInfo = definition;
      return sequence;
    }
    const mapping = this._objectReader.allowMappingStart();
    if (mapping) {
      const mappingDefinitions = definition.getDefinitionsOfType(DefinitionType.Mapping);
      if (mappingDefinitions.length > 0) {
        if (mappingDefinitions.length > 1 || Object.keys(mappingDefinitions[0].properties).length > 0 || !mappingDefinitions[0].looseKeyType) {
          this.handleMappingWithWellKnownProperties(definition, mappingDefinitions, mapping);
        } else {
          const keyDefinition = new DefinitionInfo(definition, mappingDefinitions[0].looseKeyType);
          const valueDefinition = new DefinitionInfo(definition, mappingDefinitions[0].looseValueType);
          this.handleMappingWithAllLooseProperties(definition, keyDefinition, valueDefinition, mappingDefinitions[0], mapping);
        }
      } else {
        this._context.error(mapping, "A mapping was not expected");
        while (!this._objectReader.allowMappingEnd()) {
          this.skipValue();
          this.skipValue();
        }
      }
      if (!mapping.definitionInfo) {
        mapping.definitionInfo = definition;
      }
      return mapping;
    }
    throw new Error("Expected a scalar value, a sequence, or a mapping");
  }
  handleMappingWithWellKnownProperties(definition, mappingDefinitions, mapping) {
    let looseKeyType;
    let looseValueType;
    let looseKeyDefinition;
    let looseValueDefinition;
    if (mappingDefinitions[0].looseKeyType) {
      looseKeyType = mappingDefinitions[0].looseKeyType;
      looseValueType = mappingDefinitions[0].looseValueType;
    }
    const upperKeys = {};
    let hasExpressionKey = false;
    let rawLiteral;
    while (rawLiteral = this._objectReader.allowLiteral()) {
      const nextKeyScalar = this.parseScalar(rawLiteral, definition);
      if (nextKeyScalar.isExpression) {
        hasExpressionKey = true;
        if (definition.allowedContext.length > 0) {
          const anyDefinition = new DefinitionInfo(definition, ANY);
          mapping.add(nextKeyScalar, this.readValue(anyDefinition));
        } else {
          this._context.error(nextKeyScalar, "A template expression is not allowed in this context");
          this.skipValue();
        }
        continue;
      }
      const nextKey = nextKeyScalar.templateTokenType === TokenType2.String ? nextKeyScalar : new StringToken(nextKeyScalar.file, nextKeyScalar.range, nextKeyScalar.toString(), nextKeyScalar.definitionInfo);
      if (nextKey.value) {
        const upperKey = nextKey.value.toUpperCase();
        if (upperKeys[upperKey]) {
          this._context.error(nextKey, `'${nextKey.value}' is already defined`);
          this.skipValue();
          continue;
        }
        upperKeys[upperKey] = true;
      }
      const nextPropertyDef = this._schema.matchPropertyAndFilter(mappingDefinitions, nextKey.value);
      if (nextPropertyDef) {
        if (!this.backgroundStepsEnabled() && backgroundStepProperties.has(nextKey.value)) {
          this._context.error(nextKey, `Unexpected value '${nextKey.value}'`);
          this.skipValue();
          continue;
        }
        const nextDefinition = new DefinitionInfo(definition, nextPropertyDef.type);
        nextKey.definitionInfo = nextDefinition;
        if (nextPropertyDef.description) {
          nextKey.description = nextPropertyDef.description;
        }
        const nextValue = this.readValue(nextDefinition);
        mapping.add(nextKey, nextValue);
        continue;
      }
      if (looseKeyType) {
        if (!looseKeyDefinition) {
          looseKeyDefinition = new DefinitionInfo(definition, looseKeyType);
          looseValueDefinition = new DefinitionInfo(definition, looseValueType);
        }
        this.validate(nextKey, looseKeyDefinition);
        const nextDefinition = new DefinitionInfo(definition, mappingDefinitions[0].looseValueType);
        nextKey.definitionInfo = nextDefinition;
        const nextValue = this.readValue(looseValueDefinition);
        mapping.add(nextKey, nextValue);
        continue;
      }
      this._context.error(nextKey, `Unexpected value '${nextKey.value}'`);
      this.skipValue();
    }
    if (mappingDefinitions.length === 1) {
      mapping.definitionInfo = new DefinitionInfo(definition, mappingDefinitions[0]);
    }
    if (mappingDefinitions.length > 1) {
      const hitCount = {};
      for (const mappingDefinition of mappingDefinitions) {
        for (const key of Object.keys(mappingDefinition.properties)) {
          hitCount[key] = (hitCount[key] ?? 0) + 1;
        }
      }
      const nonDuplicates = [];
      for (const key of Object.keys(hitCount)) {
        if (hitCount[key] === 1) {
          nonDuplicates.push(key);
        }
      }
      const properties = this.backgroundStepsEnabled() ? nonDuplicates : nonDuplicates.filter((property) => !backgroundStepOnlyProperties.has(property));
      this._context.error(mapping, `There's not enough info to determine what you meant. Add one of these properties: ${properties.sort().join(", ")}`);
    } else if (mappingDefinitions.length === 1 && !hasExpressionKey) {
      for (const propertyName of Object.keys(mappingDefinitions[0].properties)) {
        const propertyDef = mappingDefinitions[0].properties[propertyName];
        if (propertyDef.required && !upperKeys[propertyName.toUpperCase()]) {
          this._context.error(mapping, `Required property is missing: ${propertyName}`);
        }
      }
    }
    this.expectMappingEnd();
  }
  handleMappingWithAllLooseProperties(definition, keyDefinition, valueDefinition, mappingDefinition, mapping) {
    let nextValue;
    const upperKeys = {};
    let rawLiteral;
    while (rawLiteral = this._objectReader.allowLiteral()) {
      const nextKeyScalar = this.parseScalar(rawLiteral, definition);
      nextKeyScalar.definitionInfo = keyDefinition;
      if (nextKeyScalar.isExpression) {
        if (definition.allowedContext.length > 0) {
          nextValue = this.readValue(valueDefinition);
          mapping.add(nextKeyScalar, nextValue);
        } else {
          this._context.error(nextKeyScalar, "A template expression is not allowed in this context");
          this.skipValue();
        }
        continue;
      }
      const nextKey = nextKeyScalar.templateTokenType === TokenType2.String ? nextKeyScalar : new StringToken(nextKeyScalar.file, nextKeyScalar.range, nextKeyScalar.toString(), nextKeyScalar.definitionInfo);
      if (nextKey.value) {
        const upperKey = nextKey.value.toUpperCase();
        if (upperKeys[upperKey]) {
          this._context.error(nextKey, `'${nextKey.value}' is already defined`);
          this.skipValue();
          continue;
        }
        upperKeys[upperKey] = true;
      }
      this.validate(nextKey, keyDefinition);
      const nextDefinition = new DefinitionInfo(definition, mappingDefinition.looseValueType);
      nextKey.definitionInfo = nextDefinition;
      nextValue = this.readValue(valueDefinition);
      mapping.add(nextKey, nextValue);
    }
    this.expectMappingEnd();
  }
  expectMappingEnd() {
    if (!this._objectReader.allowMappingEnd()) {
      throw new Error("Expected mapping end");
    }
  }
  skipValue() {
    if (this._objectReader.allowLiteral()) {
    } else if (this._objectReader.allowSequenceStart()) {
      while (!this._objectReader.allowSequenceEnd()) {
        this.skipValue();
      }
    } else if (this._objectReader.allowMappingStart()) {
      while (!this._objectReader.allowMappingEnd()) {
        this.skipValue();
        this.skipValue();
      }
    } else {
      throw new Error("Expected a scalar value, a sequence, or a mapping");
    }
  }
  validate(scalar, definition) {
    switch (scalar.templateTokenType) {
      case TokenType2.Null:
      case TokenType2.Boolean:
      case TokenType2.Number:
      case TokenType2.String: {
        const literal = scalar;
        const scalarDefinitions = definition.getScalarDefinitions();
        let relevantDefinition;
        if (relevantDefinition = scalarDefinitions.find((x) => x.isMatch(literal))) {
          scalar.definitionInfo = new DefinitionInfo(definition, relevantDefinition);
          return scalar;
        }
        if (literal.templateTokenType !== TokenType2.String) {
          const stringLiteral = new StringToken(literal.file, literal.range, literal.toString(), literal.definitionInfo);
          if (relevantDefinition = scalarDefinitions.find((x) => x.isMatch(stringLiteral))) {
            stringLiteral.definitionInfo = new DefinitionInfo(definition, relevantDefinition);
            return stringLiteral;
          }
        }
        this._context.error(literal, `Unexpected value '${literal.toString()}'`);
        return scalar;
      }
      case TokenType2.BasicExpression:
        if (definition.allowedContext.length === 0) {
          this._context.error(scalar, "A template expression is not allowed in this context");
        }
        return scalar;
      default:
        this._context.error(scalar, `Unexpected value '${scalar.toString()}'`);
        return scalar;
    }
  }
  parseScalar(token, definitionInfo) {
    if (!isString(token) || !token.value) {
      return token;
    }
    const allowedContext = definitionInfo.allowedContext;
    const isSingleLine = token.range === void 0 || token.range.start.line === token.range.end.line;
    const raw = isSingleLine ? token.value : token.source ?? token.value;
    let startExpression = raw.indexOf(OPEN_EXPRESSION);
    if (startExpression < 0) {
      return token;
    }
    let encounteredError = false;
    const segments = [];
    let i = 0;
    while (i < raw.length) {
      if (i === startExpression) {
        startExpression = i;
        let endExpression = -1;
        let inString = false;
        for (i += OPEN_EXPRESSION.length; i < raw.length; i++) {
          if (raw[i] === "'") {
            inString = !inString;
          } else if (!inString && raw[i] === "}" && raw[i - 1] === "}") {
            endExpression = i;
            i++;
            break;
          }
        }
        if (endExpression < startExpression) {
          this._context.error(token, "The expression is not closed. An unescaped ${{ sequence was found, but the closing }} sequence was not found.");
          return token;
        }
        const rawExpression = raw.substr(startExpression + OPEN_EXPRESSION.length, endExpression - startExpression + 1 - OPEN_EXPRESSION.length - CLOSE_EXPRESSION.length);
        let tr = token.range;
        if (isSingleLine) {
          const offset = (token.source ?? raw).indexOf(OPEN_EXPRESSION) - raw.indexOf(OPEN_EXPRESSION);
          tr = {
            start: { line: tr.start.line, column: tr.start.column + startExpression + offset },
            end: { line: tr.end.line, column: tr.start.column + endExpression + 1 + offset }
          };
        } else {
          const startRaw = raw.substring(0, startExpression);
          const adjustedStartLine = startRaw.split("\n").length;
          const beginningOfLine = startRaw.lastIndexOf("\n");
          const adjustedStart = startExpression - beginningOfLine;
          const adjustedEnd = endExpression - beginningOfLine + 1;
          tr = {
            start: { line: tr.start.line + adjustedStartLine, column: adjustedStart },
            end: { line: tr.start.line + adjustedStartLine, column: adjustedEnd }
          };
        }
        const expression = this.parseIntoExpressionToken(tr, rawExpression, allowedContext, token, definitionInfo);
        if (!expression) {
          encounteredError = true;
        } else {
          if (expression.directive && (startExpression !== 0 || i < raw.length)) {
            this._context.error(token, `The directive '${expression.directive}' is not allowed in this context. Directives are not supported for expressions that are embedded within a string. Directives are only supported when the entire value is an expression.`);
            return token;
          }
          segments.push(expression);
        }
        startExpression = raw.indexOf(OPEN_EXPRESSION, i);
      } else if (i < startExpression) {
        this.addString(segments, token.range, raw.substr(i, startExpression - i), token.definitionInfo);
        i = startExpression;
      } else {
        this.addString(segments, token.range, raw.substr(i), token.definitionInfo);
        break;
      }
    }
    if (encounteredError) {
      return token;
    }
    if (segments.length === 1 && segments[0].templateTokenType === TokenType2.BasicExpression) {
      const basicExpression = segments[0];
      const str = this.getExpressionString(basicExpression.expression);
      if (str !== void 0) {
        return new StringToken(this._fileId, token.range, str, token.definitionInfo);
      }
    }
    if (segments.length === 1) {
      return segments[0];
    }
    const format2 = [];
    const args = [];
    const expressionTokens = [];
    let argIndex = 0;
    for (const segment of segments) {
      if (isString(segment)) {
        const text = segment.value.replace(/'/g, "''").replace(/\{/g, "{{").replace(/\}/g, "}}");
        format2.push(text);
      } else {
        format2.push(`{${argIndex}}`);
        argIndex++;
        const expression = segment;
        args.push(", ");
        args.push(expression.expression);
        expressionTokens.push(expression);
      }
    }
    return new BasicExpressionToken(this._fileId, token.range, `format('${format2.join("")}'${args.join("")})`, definitionInfo, expressionTokens, raw, void 0, token.blockScalarHeader);
  }
  parseIntoExpressionToken(tr, rawExpression, allowedContext, token, definitionInfo) {
    const parseExpressionResult = this.parseExpression(tr, token, rawExpression, allowedContext, definitionInfo);
    if (parseExpressionResult.error) {
      this._context.error(token, parseExpressionResult.error, tr);
      return void 0;
    }
    return parseExpressionResult.expression;
  }
  parseExpression(range, token, value, allowedContext, definitionInfo) {
    const trimmed = value.trim();
    if (!trimmed) {
      return {
        error: new Error("An expression was expected")
      };
    }
    const matchDirectiveResult = this.matchDirective(trimmed, INSERT_DIRECTIVE, 0);
    if (matchDirectiveResult.isMatch) {
      return {
        expression: new InsertExpressionToken(this._fileId, range, definitionInfo)
      };
    } else if (matchDirectiveResult.error) {
      return {
        error: matchDirectiveResult.error
      };
    }
    try {
      ExpressionToken.validateExpression(trimmed, allowedContext);
    } catch (err) {
      return {
        error: err
      };
    }
    const startTrim = value.length - value.trimStart().length;
    const endTrim = value.length - value.trimEnd().length;
    const expressionRange = {
      start: {
        ...range.start,
        column: range.start.column + OPEN_EXPRESSION.length + startTrim
      },
      end: {
        ...range.end,
        column: range.end.column - CLOSE_EXPRESSION.length - endTrim
      }
    };
    return {
      expression: new BasicExpressionToken(this._fileId, range, trimmed, definitionInfo, void 0, token.source, expressionRange, token.blockScalarHeader),
      error: void 0
    };
  }
  addString(segments, range, value, definition) {
    if (segments.length > 0 && segments[segments.length - 1].templateTokenType === TokenType2.String) {
      const lastSegment = segments[segments.length - 1];
      segments[segments.length - 1] = new StringToken(this._fileId, range, `${lastSegment.value}${value}`, definition);
    } else {
      segments.push(new StringToken(this._fileId, range, value, definition));
    }
  }
  matchDirective(trimmed, directive, expectedParameters) {
    const parameters = [];
    if (trimmed.startsWith(directive) && (trimmed.length === directive.length || WHITESPACE_PATTERN.test(trimmed[directive.length]))) {
      let startIndex = directive.length;
      let inString = false;
      let parens = 0;
      for (let i = startIndex; i < trimmed.length; i++) {
        const c = trimmed[i];
        if (WHITESPACE_PATTERN.test(c) && !inString && parens == 0) {
          if (startIndex < 1) {
            parameters.push(trimmed.substr(startIndex, i - startIndex));
          }
          startIndex = i + 1;
        } else if (c === "'") {
          inString = !inString;
        } else if (c === "(" && !inString) {
          parens++;
        } else if (c === ")" && !inString) {
          parens--;
        }
      }
      if (startIndex < trimmed.length) {
        parameters.push(trimmed.substr(startIndex));
      }
      if (expectedParameters != parameters.length) {
        return {
          isMatch: false,
          parameters: [],
          error: new Error(`Exactly ${expectedParameters} parameter(s) were expected following the directive '${directive}'. Actual parameter count: ${parameters.length}`)
        };
      }
      return {
        isMatch: true,
        parameters
      };
    }
    return {
      isMatch: false,
      parameters
    };
  }
  getExpressionString(trimmed) {
    const result = [];
    let inString = false;
    for (let i = 0; i < trimmed.length; i++) {
      const c = trimmed[i];
      if (c === "'") {
        inString = !inString;
        if (inString && i !== 0) {
          result.push(c);
        }
      } else if (!inString) {
        return void 0;
      } else {
        result.push(c);
      }
    }
    return result.join("");
  }
  backgroundStepsEnabled() {
    return this._context.state.featureFlags?.isEnabled("allowBackgroundSteps") ?? false;
  }
};

// node_modules/@actions/workflow-parser/dist/workflows/workflow-constants.js
var WORKFLOW_ROOT = "workflow-root-strict";

// node_modules/@actions/workflow-parser/dist/templates/parse-event.js
var ParseEvent = class {
  constructor(type, token) {
    this.type = type;
    this.token = token;
  }
};
var EventType;
(function(EventType2) {
  EventType2[EventType2["Literal"] = 0] = "Literal";
  EventType2[EventType2["SequenceStart"] = 1] = "SequenceStart";
  EventType2[EventType2["SequenceEnd"] = 2] = "SequenceEnd";
  EventType2[EventType2["MappingStart"] = 3] = "MappingStart";
  EventType2[EventType2["MappingEnd"] = 4] = "MappingEnd";
  EventType2[EventType2["DocumentStart"] = 5] = "DocumentStart";
  EventType2[EventType2["DocumentEnd"] = 6] = "DocumentEnd";
})(EventType || (EventType = {}));

// node_modules/@actions/workflow-parser/dist/templates/json-object-reader.js
var JSONObjectReader = class {
  constructor(fileId, input) {
    this._fileId = fileId;
    const value = JSON.parse(input);
    this._generator = this.getParseEvents(value, true);
    this._current = this._generator.next();
  }
  allowLiteral() {
    if (!this._current.done) {
      const parseEvent = this._current.value;
      if (parseEvent.type === EventType.Literal) {
        this._current = this._generator.next();
        return parseEvent.token;
      }
    }
    return void 0;
  }
  allowSequenceStart() {
    if (!this._current.done) {
      const parseEvent = this._current.value;
      if (parseEvent.type === EventType.SequenceStart) {
        this._current = this._generator.next();
        return parseEvent.token;
      }
    }
    return void 0;
  }
  allowSequenceEnd() {
    if (!this._current.done) {
      const parseEvent = this._current.value;
      if (parseEvent.type === EventType.SequenceEnd) {
        this._current = this._generator.next();
        return true;
      }
    }
    return false;
  }
  allowMappingStart() {
    if (!this._current.done) {
      const parseEvent = this._current.value;
      if (parseEvent.type === EventType.MappingStart) {
        this._current = this._generator.next();
        return parseEvent.token;
      }
    }
    return void 0;
  }
  allowMappingEnd() {
    if (!this._current.done) {
      const parseEvent = this._current.value;
      if (parseEvent.type === EventType.MappingEnd) {
        this._current = this._generator.next();
        return true;
      }
    }
    return false;
  }
  validateEnd() {
    if (!this._current.done) {
      const parseEvent = this._current.value;
      if (parseEvent.type === EventType.DocumentEnd) {
        this._current = this._generator.next();
        return;
      }
    }
    throw new Error("Expected end of reader");
  }
  validateStart() {
    if (!this._current.done) {
      const parseEvent = this._current.value;
      if (parseEvent.type === EventType.DocumentStart) {
        this._current = this._generator.next();
        return;
      }
    }
    throw new Error("Expected start of reader");
  }
  /**
   * Returns all tokens (depth first)
   */
  *getParseEvents(value, root) {
    if (root) {
      yield new ParseEvent(EventType.DocumentStart, void 0);
    }
    switch (typeof value) {
      case "undefined":
        yield new ParseEvent(EventType.Literal, new NullToken(this._fileId, void 0, void 0));
        break;
      case "boolean":
        yield new ParseEvent(EventType.Literal, new BooleanToken(this._fileId, void 0, value, void 0));
        break;
      case "number":
        yield new ParseEvent(EventType.Literal, new NumberToken(this._fileId, void 0, value, void 0));
        break;
      case "string":
        yield new ParseEvent(EventType.Literal, new StringToken(this._fileId, void 0, value, void 0));
        break;
      case "object":
        if (value === null) {
          yield new ParseEvent(EventType.Literal, new NullToken(this._fileId, void 0, void 0));
        } else if (Array.isArray(value)) {
          yield new ParseEvent(EventType.SequenceStart, new SequenceToken(this._fileId, void 0, void 0));
          for (const item of value) {
            for (const e of this.getParseEvents(item)) {
              yield e;
            }
          }
          yield new ParseEvent(EventType.SequenceEnd, void 0);
        } else {
          yield new ParseEvent(EventType.MappingStart, new MappingToken(this._fileId, void 0, void 0));
          for (const key of Object.keys(value)) {
            yield new ParseEvent(EventType.Literal, new StringToken(this._fileId, void 0, key, void 0));
            for (const e of this.getParseEvents(value[key])) {
              yield e;
            }
          }
          yield new ParseEvent(EventType.MappingEnd, void 0);
        }
        break;
      default:
        throw new Error(`Unexpected value type '${typeof value}' when reading object`);
    }
    if (root) {
      yield new ParseEvent(EventType.DocumentEnd, void 0);
    }
  }
};

// node_modules/@actions/workflow-parser/dist/templates/trace-writer.js
var NoOperationTraceWriter = class {
  error() {
  }
  info() {
  }
  verbose() {
  }
};

// node_modules/@actions/workflow-parser/dist/templates/schema/definition.js
var Definition = class {
  constructor(key, definition) {
    this.readerContext = [];
    this.evaluatorContext = [];
    this.key = key;
    if (definition) {
      for (let i = 0; i < definition.count; ) {
        const definitionKey = definition.get(i).key.assertString(`${DEFINITION} key`);
        switch (definitionKey.value) {
          case CONTEXT: {
            const context = definition.get(i).value.assertSequence(`${DEFINITION} ${CONTEXT}`);
            definition.remove(i);
            const seenReaderContext = {};
            const seenEvaluatorContext = {};
            for (const item of context) {
              const itemStr = item.assertString(`${CONTEXT} item`).value;
              const upperItemStr = itemStr.toUpperCase();
              if (seenReaderContext[upperItemStr]) {
                throw new Error(`Duplicate context item '${itemStr}'`);
              }
              seenReaderContext[upperItemStr] = true;
              this.readerContext.push(itemStr);
              const paramIndex = itemStr.indexOf("(");
              const modifiedItemStr = paramIndex > 0 ? itemStr.substr(0, paramIndex + 1) + ")" : itemStr;
              const upperModifiedItemStr = modifiedItemStr.toUpperCase();
              if (seenEvaluatorContext[upperModifiedItemStr]) {
                throw new Error(`Duplicate context item '${modifiedItemStr}'`);
              }
              seenEvaluatorContext[upperModifiedItemStr] = true;
              this.evaluatorContext.push(modifiedItemStr);
            }
            break;
          }
          case DESCRIPTION: {
            const value = definition.get(i).value;
            this.description = value.assertString(DESCRIPTION).value;
            definition.remove(i);
            break;
          }
          default: {
            i++;
            break;
          }
        }
      }
    }
  }
};

// node_modules/@actions/workflow-parser/dist/templates/schema/scalar-definition.js
var ScalarDefinition = class extends Definition {
  constructor(key, definition) {
    super(key, definition);
  }
};

// node_modules/@actions/workflow-parser/dist/templates/schema/boolean-definition.js
var BooleanDefinition = class extends ScalarDefinition {
  constructor(key, definition) {
    super(key, definition);
    if (definition) {
      for (const definitionPair of definition) {
        const definitionKey = definitionPair.key.assertString(`${DEFINITION} key`);
        switch (definitionKey.value) {
          case BOOLEAN: {
            const mapping = definitionPair.value.assertMapping(`${DEFINITION} ${BOOLEAN}`);
            for (const mappingPair of mapping) {
              const mappingKey = mappingPair.key.assertString(`${DEFINITION} ${BOOLEAN} key`);
              switch (mappingKey.value) {
                default:
                  mappingKey.assertUnexpectedValue(`${DEFINITION} ${BOOLEAN} key`);
                  break;
              }
            }
            break;
          }
          default:
            definitionKey.assertUnexpectedValue(`${DEFINITION} key`);
        }
      }
    }
  }
  get definitionType() {
    return DefinitionType.Boolean;
  }
  isMatch(literal) {
    return literal.templateTokenType === TokenType2.Boolean;
  }
  validate() {
  }
};

// node_modules/@actions/workflow-parser/dist/templates/schema/property-definition.js
var PropertyDefinition = class {
  constructor(token) {
    this.type = "";
    this.required = false;
    if (token.templateTokenType === TokenType2.String) {
      this.type = token.value;
    } else {
      const mapping = token.assertMapping(MAPPING_PROPERTY_VALUE);
      for (const mappingPair of mapping) {
        const mappingKey = mappingPair.key.assertString(`${MAPPING_PROPERTY_VALUE} key`);
        switch (mappingKey.value) {
          case TYPE:
            this.type = mappingPair.value.assertString(`${MAPPING_PROPERTY_VALUE} ${TYPE}`).value;
            break;
          case REQUIRED:
            this.required = mappingPair.value.assertBoolean(`${MAPPING_PROPERTY_VALUE} ${REQUIRED}`).value;
            break;
          case DESCRIPTION:
            this.description = mappingPair.value.assertString(`${MAPPING_PROPERTY_VALUE} ${DESCRIPTION}`).value;
            break;
          default:
            mappingKey.assertUnexpectedValue(`${MAPPING_PROPERTY_VALUE} key`);
        }
      }
    }
  }
};

// node_modules/@actions/workflow-parser/dist/templates/schema/mapping-definition.js
var MappingDefinition = class extends Definition {
  constructor(key, definition) {
    super(key, definition);
    this.properties = {};
    this.looseKeyType = "";
    this.looseValueType = "";
    if (definition) {
      for (const definitionPair of definition) {
        const definitionKey = definitionPair.key.assertString(`${DEFINITION} key`);
        switch (definitionKey.value) {
          case MAPPING: {
            const mapping = definitionPair.value.assertMapping(`${DEFINITION} ${MAPPING}`);
            for (const mappingPair of mapping) {
              const mappingKey = mappingPair.key.assertString(`${DEFINITION} ${MAPPING} key`);
              switch (mappingKey.value) {
                case PROPERTIES: {
                  const properties = mappingPair.value.assertMapping(`${DEFINITION} ${MAPPING} ${PROPERTIES}`);
                  for (const propertiesPair of properties) {
                    const propertyName = propertiesPair.key.assertString(`${DEFINITION} ${MAPPING} ${PROPERTIES} key`);
                    this.properties[propertyName.value] = new PropertyDefinition(propertiesPair.value);
                  }
                  break;
                }
                case LOOSE_KEY_TYPE: {
                  const looseKeyType = mappingPair.value.assertString(`${DEFINITION} ${MAPPING} ${LOOSE_KEY_TYPE}`);
                  this.looseKeyType = looseKeyType.value;
                  break;
                }
                case LOOSE_VALUE_TYPE: {
                  const looseValueType = mappingPair.value.assertString(`${DEFINITION} ${MAPPING} ${LOOSE_VALUE_TYPE}`);
                  this.looseValueType = looseValueType.value;
                  break;
                }
                default:
                  mappingKey.assertUnexpectedValue(`${DEFINITION} ${MAPPING} key`);
                  break;
              }
            }
            break;
          }
          default:
            definitionKey.assertUnexpectedValue(`${DEFINITION} key`);
        }
      }
    }
  }
  get definitionType() {
    return DefinitionType.Mapping;
  }
  validate(schema2, name2) {
    if (this.looseKeyType) {
      schema2.getDefinition(this.looseKeyType);
      if (this.looseValueType) {
        schema2.getDefinition(this.looseValueType);
      } else {
        throw new Error(`Property '${LOOSE_KEY_TYPE}' is defined but '${LOOSE_VALUE_TYPE}' is not defined on '${name2}'`);
      }
    } else if (this.looseValueType) {
      throw new Error(`Property '${LOOSE_VALUE_TYPE}' is defined but '${LOOSE_KEY_TYPE}' is not defined on '${name2}'`);
    }
    for (const propertyName of Object.keys(this.properties)) {
      const propertyDef = this.properties[propertyName];
      if (!propertyDef.type) {
        throw new Error(`Type not specified for the property '${propertyName}' on '${name2}'`);
      }
      schema2.getDefinition(propertyDef.type);
    }
  }
};

// node_modules/@actions/workflow-parser/dist/templates/schema/null-definition.js
var NullDefinition = class extends ScalarDefinition {
  constructor(key, definition) {
    super(key, definition);
    if (definition) {
      for (const definitionPair of definition) {
        const definitionKey = definitionPair.key.assertString(`${DEFINITION} key`);
        switch (definitionKey.value) {
          case NULL: {
            const mapping = definitionPair.value.assertMapping(`${DEFINITION} ${NULL}`);
            for (const mappingPair of mapping) {
              const mappingKey = mappingPair.key.assertString(`${DEFINITION} ${NULL} key`);
              switch (mappingKey.value) {
                default:
                  mappingKey.assertUnexpectedValue(`${DEFINITION} ${NULL} key`);
                  break;
              }
            }
            break;
          }
          default:
            definitionKey.assertUnexpectedValue(`${DEFINITION} key`);
        }
      }
    }
  }
  get definitionType() {
    return DefinitionType.Null;
  }
  isMatch(literal) {
    return literal.templateTokenType === TokenType2.Null;
  }
  validate() {
  }
};

// node_modules/@actions/workflow-parser/dist/templates/schema/number-definition.js
var NumberDefinition = class extends ScalarDefinition {
  constructor(key, definition) {
    super(key, definition);
    if (definition) {
      for (const definitionPair of definition) {
        const definitionKey = definitionPair.key.assertString(`${DEFINITION} key`);
        switch (definitionKey.value) {
          case NUMBER: {
            const mapping = definitionPair.value.assertMapping(`${DEFINITION} ${NUMBER}`);
            for (const mappingPair of mapping) {
              const mappingKey = mappingPair.key.assertString(`${DEFINITION} ${NUMBER} key`);
              switch (mappingKey.value) {
                default:
                  mappingKey.assertUnexpectedValue(`${DEFINITION} ${NUMBER} key`);
                  break;
              }
            }
            break;
          }
          default:
            definitionKey.assertUnexpectedValue(`${DEFINITION} key`);
        }
      }
    }
  }
  get definitionType() {
    return DefinitionType.Number;
  }
  isMatch(literal) {
    return literal.templateTokenType === TokenType2.Number;
  }
  validate() {
  }
};

// node_modules/@actions/workflow-parser/dist/templates/schema/one-of-definition.js
var OneOfDefinition = class extends Definition {
  constructor(key, definition) {
    super(key, definition);
    this.oneOf = [];
    this.oneOfPrefix = [];
    if (definition) {
      for (const definitionPair of definition) {
        const definitionKey = definitionPair.key.assertString(`${DEFINITION} key`);
        switch (definitionKey.value) {
          case ONE_OF: {
            const oneOf = definitionPair.value.assertSequence(`${DEFINITION} ${ONE_OF}`);
            for (const item of oneOf) {
              const oneOfItem = item.assertString(`${DEFINITION} ${ONE_OF} item`);
              this.oneOf.push(oneOfItem.value);
            }
            break;
          }
          case ALLOWED_VALUES: {
            const oneOf = definitionPair.value.assertSequence(`${DEFINITION} ${ALLOWED_VALUES}`);
            for (const item of oneOf) {
              const oneOfItem = item.assertString(`${DEFINITION} ${ONE_OF} item`);
              this.oneOf.push(this.key + "-" + oneOfItem.value);
            }
            break;
          }
          default:
            definitionKey.assertUnexpectedValue(`${DEFINITION} key`);
            break;
        }
      }
    }
  }
  get definitionType() {
    return DefinitionType.OneOf;
  }
  validate(schema2, name2) {
    if (this.oneOf.length === 0) {
      throw new Error(`'${name2}' does not contain any references`);
    }
    let foundLooseKeyType = false;
    const mappingDefinitions = [];
    let allowedValuesDefinition;
    let sequenceDefinition;
    let nullDefinition;
    let booleanDefinition;
    let numberDefinition;
    const stringDefinitions = [];
    const seenNestedTypes = {};
    for (const nestedType of this.oneOf) {
      if (seenNestedTypes[nestedType]) {
        throw new Error(`'${name2}' contains duplicate nested type '${nestedType}'`);
      }
      seenNestedTypes[nestedType] = true;
      const nestedDefinition = schema2.getDefinition(nestedType);
      if (nestedDefinition.readerContext.length > 0) {
        throw new Error(`'${name2}' is a one-of definition and references another definition that defines context. This is currently not supported.`);
      }
      switch (nestedDefinition.definitionType) {
        case DefinitionType.Mapping: {
          const mappingDefinition = nestedDefinition;
          mappingDefinitions.push(mappingDefinition);
          if (mappingDefinition.looseKeyType) {
            foundLooseKeyType = true;
          }
          break;
        }
        case DefinitionType.Sequence: {
          if (sequenceDefinition) {
            throw new Error(`'${name2}' refers to more than one definition of type '${SEQUENCE}'`);
          }
          sequenceDefinition = nestedDefinition;
          break;
        }
        case DefinitionType.Null: {
          if (nullDefinition) {
            throw new Error(`'${name2}' refers to more than one definition of type '${NULL}'`);
          }
          nullDefinition = nestedDefinition;
          break;
        }
        case DefinitionType.Boolean: {
          if (booleanDefinition) {
            throw new Error(`'${name2}' refers to more than one definition of type '${BOOLEAN}'`);
          }
          booleanDefinition = nestedDefinition;
          break;
        }
        case DefinitionType.Number: {
          if (numberDefinition) {
            throw new Error(`'${name2}' refers to more than one definition of type '${NUMBER}'`);
          }
          numberDefinition = nestedDefinition;
          break;
        }
        case DefinitionType.String: {
          const stringDefinition = nestedDefinition;
          if (stringDefinitions.length > 0 && (!stringDefinitions[0].constant || !stringDefinition.constant)) {
            throw new Error(`'${name2}' refers to more than one '${SCALAR}', but some do not set '${CONSTANT}'`);
          }
          stringDefinitions.push(stringDefinition);
          break;
        }
        case DefinitionType.OneOf: {
          if (allowedValuesDefinition) {
            throw new Error(`'${name2}' contains multiple allowed-values definitions`);
          }
          allowedValuesDefinition = nestedDefinition;
          break;
        }
        default:
          throw new Error(`'${name2}' refers to a definition with type '${nestedDefinition.definitionType}'`);
      }
    }
    if (mappingDefinitions.length > 1) {
      if (foundLooseKeyType) {
        throw new Error(`'${name2}' refers to two mappings and at least one sets '${LOOSE_KEY_TYPE}'. This is not currently supported.`);
      }
      const seenProperties = {};
      for (const mappingDefinition of mappingDefinitions) {
        for (const propertyName of Object.keys(mappingDefinition.properties)) {
          const newPropertyDef = mappingDefinition.properties[propertyName];
          const existingPropertyDef = seenProperties[propertyName];
          if (existingPropertyDef) {
            if (existingPropertyDef.type === newPropertyDef.type) {
              continue;
            }
            throw new Error(`'${name2}' contains two mappings with the same property, but each refers to a different type. All matching properties must refer to the same type.`);
          } else {
            seenProperties[propertyName] = newPropertyDef;
          }
        }
      }
    }
  }
};

// node_modules/@actions/workflow-parser/dist/templates/schema/sequence-definition.js
var SequenceDefinition = class extends Definition {
  constructor(key, definition) {
    super(key, definition);
    this.itemType = "";
    if (definition) {
      for (const definitionPair of definition) {
        const definitionKey = definitionPair.key.assertString(`${DEFINITION} key`);
        switch (definitionKey.value) {
          case SEQUENCE: {
            const mapping = definitionPair.value.assertMapping(`${DEFINITION} ${SEQUENCE}`);
            for (const mappingPair of mapping) {
              const mappingKey = mappingPair.key.assertString(`${DEFINITION} ${SEQUENCE} key`);
              switch (mappingKey.value) {
                case ITEM_TYPE: {
                  const itemType = mappingPair.value.assertString(`${DEFINITION} ${SEQUENCE} ${ITEM_TYPE}`);
                  this.itemType = itemType.value;
                  break;
                }
                default:
                  mappingKey.assertUnexpectedValue(`${DEFINITION} ${SEQUENCE} key`);
                  break;
              }
            }
            break;
          }
          default:
            definitionKey.assertUnexpectedValue(`${DEFINITION} key`);
        }
      }
    }
  }
  get definitionType() {
    return DefinitionType.Sequence;
  }
  validate(schema2, name2) {
    if (!this.itemType) {
      throw new Error(`'${name2}' does not defined '${ITEM_TYPE}'`);
    }
    schema2.getDefinition(this.itemType);
  }
};

// node_modules/@actions/workflow-parser/dist/templates/schema/string-definition.js
var StringDefinition = class extends ScalarDefinition {
  constructor(key, definition) {
    super(key, definition);
    this.constant = "";
    this.ignoreCase = false;
    this.requireNonEmpty = false;
    this.isExpression = false;
    if (definition) {
      for (const definitionPair of definition) {
        const definitionKey = definitionPair.key.assertString(`${DEFINITION} key`);
        switch (definitionKey.value) {
          case STRING: {
            const mapping = definitionPair.value.assertMapping(`${DEFINITION} ${STRING}`);
            for (const mappingPair of mapping) {
              const mappingKey = mappingPair.key.assertString(`${DEFINITION} ${STRING} key`);
              switch (mappingKey.value) {
                case CONSTANT: {
                  const constantStringToken = mappingPair.value.assertString(`${DEFINITION} ${STRING} ${CONSTANT}`);
                  this.constant = constantStringToken.value;
                  break;
                }
                case IGNORE_CASE: {
                  const ignoreCaseBooleanToken = mappingPair.value.assertBoolean(`${DEFINITION} ${STRING} ${IGNORE_CASE}`);
                  this.ignoreCase = ignoreCaseBooleanToken.value;
                  break;
                }
                case REQUIRE_NON_EMPTY: {
                  const requireNonEmptyBooleanToken = mappingPair.value.assertBoolean(`${DEFINITION} ${STRING} ${REQUIRE_NON_EMPTY}`);
                  this.requireNonEmpty = requireNonEmptyBooleanToken.value;
                  break;
                }
                case IS_EXPRESSION: {
                  const isExpressionToken = mappingPair.value.assertBoolean(`${DEFINITION} ${STRING} ${IS_EXPRESSION}`);
                  this.isExpression = isExpressionToken.value;
                  break;
                }
                default:
                  mappingKey.assertUnexpectedValue(`${DEFINITION} ${STRING} key`);
                  break;
              }
            }
            break;
          }
          default:
            definitionKey.assertUnexpectedValue(`${DEFINITION} key`);
        }
      }
    }
  }
  get definitionType() {
    return DefinitionType.String;
  }
  isMatch(literal) {
    if (literal.templateTokenType === TokenType2.String) {
      const value = literal.value;
      if (this.constant) {
        return this.ignoreCase ? this.constant.toUpperCase() === value.toUpperCase() : this.constant === value;
      } else if (this.requireNonEmpty) {
        return !!value;
      } else {
        return true;
      }
    }
    return false;
  }
  validate() {
    if (this.constant && this.requireNonEmpty) {
      throw new Error(`Properties '${CONSTANT}' and '${REQUIRE_NON_EMPTY}' cannot both be set`);
    }
  }
};

// node_modules/@actions/workflow-parser/dist/templates/schema/template-schema.js
var TemplateSchema = class _TemplateSchema {
  constructor(mapping) {
    this.definitions = {};
    this.version = "";
    this.definitions[NULL] = new NullDefinition(NULL);
    this.definitions[BOOLEAN] = new BooleanDefinition(BOOLEAN);
    this.definitions[NUMBER] = new NumberDefinition(NUMBER);
    this.definitions[STRING] = new StringDefinition(STRING);
    const sequenceDefinition = new SequenceDefinition(SEQUENCE);
    sequenceDefinition.itemType = ANY;
    this.definitions[sequenceDefinition.key] = sequenceDefinition;
    const mappingDefinition = new MappingDefinition(MAPPING);
    mappingDefinition.looseKeyType = STRING;
    mappingDefinition.looseValueType = ANY;
    this.definitions[mappingDefinition.key] = mappingDefinition;
    const anyDefinition = new OneOfDefinition(ANY);
    anyDefinition.oneOf.push(NULL);
    anyDefinition.oneOf.push(BOOLEAN);
    anyDefinition.oneOf.push(NUMBER);
    anyDefinition.oneOf.push(STRING);
    anyDefinition.oneOf.push(SEQUENCE);
    anyDefinition.oneOf.push(MAPPING);
    this.definitions[anyDefinition.key] = anyDefinition;
    if (mapping) {
      for (const pair of mapping) {
        const key = pair.key.assertString(`${TEMPLATE_SCHEMA} key`);
        switch (key.value) {
          case VERSION: {
            this.version = pair.value.assertString(`${TEMPLATE_SCHEMA} ${VERSION}`).value;
            break;
          }
          case DEFINITIONS: {
            const definitions = pair.value.assertMapping(`${TEMPLATE_SCHEMA} ${DEFINITIONS}`);
            for (const definitionsPair of definitions) {
              const definitionsKey = definitionsPair.key.assertString(`${TEMPLATE_SCHEMA} ${DEFINITIONS} key`);
              const definitionsValue = definitionsPair.value.assertMapping(`${TEMPLATE_SCHEMA} ${DEFINITIONS} value`);
              let definition;
              for (const definitionPair of definitionsValue) {
                const definitionKey = definitionPair.key.assertString(`${DEFINITION} key`);
                const mappingToken = definitionsPair.value;
                switch (definitionKey.value) {
                  case NULL:
                    definition = new NullDefinition(definitionsKey.value, definitionsValue);
                    break;
                  case BOOLEAN:
                    definition = new BooleanDefinition(definitionsKey.value, definitionsValue);
                    break;
                  case NUMBER:
                    definition = new NumberDefinition(definitionsKey.value, definitionsValue);
                    break;
                  case STRING:
                    definition = new StringDefinition(definitionsKey.value, definitionsValue);
                    break;
                  case SEQUENCE:
                    definition = new SequenceDefinition(definitionsKey.value, definitionsValue);
                    break;
                  case MAPPING:
                    definition = new MappingDefinition(definitionsKey.value, definitionsValue);
                    break;
                  case ONE_OF:
                    definition = new OneOfDefinition(definitionsKey.value, definitionsValue);
                    break;
                  case ALLOWED_VALUES:
                    for (const item of mappingToken) {
                      if (item.value.templateTokenType === TokenType2.Sequence) {
                        const sequenceToken = item.value;
                        for (const activity of sequenceToken) {
                          if (activity.templateTokenType === TokenType2.String) {
                            const stringToken = activity;
                            const allowedValuesKey = definitionsKey.value + "-" + stringToken.value;
                            const allowedValuesDef = new StringDefinition(allowedValuesKey);
                            allowedValuesDef.constant = stringToken.toDisplayString();
                            this.definitions[allowedValuesKey] = allowedValuesDef;
                          }
                        }
                      }
                    }
                    definition = new OneOfDefinition(definitionsKey.value, definitionsValue);
                    break;
                  case CONTEXT:
                  case DESCRIPTION:
                    continue;
                  default:
                    definitionKey.assertUnexpectedValue(`${DEFINITION} mapping key`);
                    break;
                }
                break;
              }
              if (!definition) {
                throw new Error(`Not enough information to construct definition '${definitionsKey.value}'`);
              }
              this.definitions[definitionsKey.value] = definition;
            }
            break;
          }
          default:
            key.assertUnexpectedValue(`${TEMPLATE_SCHEMA} key`);
            break;
        }
      }
    }
  }
  /**
   * Looks up a definition by name
   */
  getDefinition(name2) {
    const result = this.definitions[name2];
    if (result) {
      return result;
    }
    throw new Error(`Schema definition '${name2}' not found`);
  }
  /**
   * Expands one-of definitions and returns all scalar definitions
   */
  getScalarDefinitions(definition) {
    const result = [];
    switch (definition.definitionType) {
      case DefinitionType.Null:
      case DefinitionType.Boolean:
      case DefinitionType.Number:
      case DefinitionType.String:
        result.push(definition);
        break;
      case DefinitionType.OneOf: {
        const oneOf = definition;
        for (const nestedName of oneOf.oneOf) {
          const nestedDefinition = this.getDefinition(nestedName);
          result.push(...this.getScalarDefinitions(nestedDefinition));
        }
        break;
      }
    }
    return result;
  }
  /**
   * Expands one-of definitions and returns all matching definitions by type
   */
  getDefinitionsOfType(definition, type) {
    const result = [];
    if (definition.definitionType === type) {
      result.push(definition);
    } else if (definition.definitionType === DefinitionType.OneOf) {
      const oneOf = definition;
      for (const nestedName of oneOf.oneOf) {
        const nestedDefinition = this.getDefinition(nestedName);
        if (nestedDefinition.definitionType === type) {
          result.push(nestedDefinition);
        }
      }
    }
    return result;
  }
  /**
   * Attempts match the property name to a property defined by any of the specified definitions.
   * If matched, any unmatching definitions are filtered from the definitions array.
   * Returns the type information for the matched property.
   */
  matchPropertyAndFilter(definitions, propertyName) {
    let result;
    let notFoundInSome = false;
    for (const definition of definitions) {
      const propertyDef = definition.properties[propertyName];
      if (propertyDef) {
        result = propertyDef;
      } else {
        notFoundInSome = true;
      }
    }
    if (result && notFoundInSome) {
      for (let i = 0; i < definitions.length; ) {
        if (definitions[i].properties[propertyName]) {
          i++;
        } else {
          definitions.splice(i, 1);
        }
      }
    }
    return result;
  }
  validate() {
    const oneOfDefinitions = {};
    for (const name2 of Object.keys(this.definitions)) {
      if (!name2.match(_TemplateSchema._definitionNamePattern)) {
        throw new Error(`Invalid definition name '${name2}'`);
      }
      const definition = this.definitions[name2];
      if (definition.definitionType === DefinitionType.OneOf) {
        oneOfDefinitions[name2] = definition;
      } else {
        definition.validate(this, name2);
      }
    }
    for (const name2 of Object.keys(oneOfDefinitions)) {
      const oneOf = oneOfDefinitions[name2];
      oneOf.validate(this, name2);
    }
  }
  /**
   * Loads a user-defined schema file
   */
  static load(objectReader) {
    const context = new TemplateContext(new TemplateValidationErrors(10, 500), _TemplateSchema.getInternalSchema(), new NoOperationTraceWriter());
    const template = readTemplate(context, TEMPLATE_SCHEMA, objectReader, void 0);
    context.errors.check();
    const mapping = template.assertMapping(TEMPLATE_SCHEMA);
    const schema2 = new _TemplateSchema(mapping);
    schema2.validate();
    return schema2;
  }
  /**
   * Gets the internal schema used for reading user-defined schema files
   */
  static getInternalSchema() {
    if (_TemplateSchema._internalSchema === void 0) {
      const schema2 = new _TemplateSchema();
      let mappingDefinition = new MappingDefinition(TEMPLATE_SCHEMA);
      mappingDefinition.properties[VERSION] = new PropertyDefinition(new StringToken(void 0, void 0, NON_EMPTY_STRING, void 0));
      mappingDefinition.properties[DEFINITIONS] = new PropertyDefinition(new StringToken(void 0, void 0, DEFINITIONS, void 0));
      schema2.definitions[mappingDefinition.key] = mappingDefinition;
      mappingDefinition = new MappingDefinition(DEFINITIONS);
      mappingDefinition.looseKeyType = NON_EMPTY_STRING;
      mappingDefinition.looseValueType = DEFINITION;
      schema2.definitions[mappingDefinition.key] = mappingDefinition;
      let oneOfDefinition = new OneOfDefinition(DEFINITION);
      oneOfDefinition.oneOf.push(NULL_DEFINITION);
      oneOfDefinition.oneOf.push(BOOLEAN_DEFINITION);
      oneOfDefinition.oneOf.push(NUMBER_DEFINITION);
      oneOfDefinition.oneOf.push(STRING_DEFINITION);
      oneOfDefinition.oneOf.push(SEQUENCE_DEFINITION);
      oneOfDefinition.oneOf.push(MAPPING_DEFINITION);
      oneOfDefinition.oneOf.push(ONE_OF_DEFINITION);
      schema2.definitions[oneOfDefinition.key] = oneOfDefinition;
      mappingDefinition = new MappingDefinition(NULL_DEFINITION);
      mappingDefinition.properties[DESCRIPTION] = new PropertyDefinition(new StringToken(void 0, void 0, STRING, void 0));
      mappingDefinition.properties[CONTEXT] = new PropertyDefinition(new StringToken(void 0, void 0, SEQUENCE_OF_NON_EMPTY_STRING, void 0));
      mappingDefinition.properties[NULL] = new PropertyDefinition(new StringToken(void 0, void 0, NULL_DEFINITION_PROPERTIES, void 0));
      schema2.definitions[mappingDefinition.key] = mappingDefinition;
      mappingDefinition = new MappingDefinition(NULL_DEFINITION_PROPERTIES);
      schema2.definitions[mappingDefinition.key] = mappingDefinition;
      mappingDefinition = new MappingDefinition(BOOLEAN_DEFINITION);
      mappingDefinition.properties[DESCRIPTION] = new PropertyDefinition(new StringToken(void 0, void 0, STRING, void 0));
      mappingDefinition.properties[CONTEXT] = new PropertyDefinition(new StringToken(void 0, void 0, SEQUENCE_OF_NON_EMPTY_STRING, void 0));
      mappingDefinition.properties[BOOLEAN] = new PropertyDefinition(new StringToken(void 0, void 0, BOOLEAN_DEFINITION_PROPERTIES, void 0));
      schema2.definitions[mappingDefinition.key] = mappingDefinition;
      mappingDefinition = new MappingDefinition(BOOLEAN_DEFINITION_PROPERTIES);
      schema2.definitions[mappingDefinition.key] = mappingDefinition;
      mappingDefinition = new MappingDefinition(NUMBER_DEFINITION);
      mappingDefinition.properties[DESCRIPTION] = new PropertyDefinition(new StringToken(void 0, void 0, STRING, void 0));
      mappingDefinition.properties[CONTEXT] = new PropertyDefinition(new StringToken(void 0, void 0, SEQUENCE_OF_NON_EMPTY_STRING, void 0));
      mappingDefinition.properties[NUMBER] = new PropertyDefinition(new StringToken(void 0, void 0, NUMBER_DEFINITION_PROPERTIES, void 0));
      schema2.definitions[mappingDefinition.key] = mappingDefinition;
      mappingDefinition = new MappingDefinition(NUMBER_DEFINITION_PROPERTIES);
      schema2.definitions[mappingDefinition.key] = mappingDefinition;
      mappingDefinition = new MappingDefinition(STRING_DEFINITION);
      mappingDefinition.properties[DESCRIPTION] = new PropertyDefinition(new StringToken(void 0, void 0, STRING, void 0));
      mappingDefinition.properties[CONTEXT] = new PropertyDefinition(new StringToken(void 0, void 0, SEQUENCE_OF_NON_EMPTY_STRING, void 0));
      mappingDefinition.properties[STRING] = new PropertyDefinition(new StringToken(void 0, void 0, STRING_DEFINITION_PROPERTIES, void 0));
      schema2.definitions[mappingDefinition.key] = mappingDefinition;
      mappingDefinition = new MappingDefinition(STRING_DEFINITION_PROPERTIES);
      mappingDefinition.properties[CONSTANT] = new PropertyDefinition(new StringToken(void 0, void 0, NON_EMPTY_STRING, void 0));
      mappingDefinition.properties[IGNORE_CASE] = new PropertyDefinition(new StringToken(void 0, void 0, BOOLEAN, void 0));
      mappingDefinition.properties[REQUIRE_NON_EMPTY] = new PropertyDefinition(new StringToken(void 0, void 0, BOOLEAN, void 0));
      mappingDefinition.properties[IS_EXPRESSION] = new PropertyDefinition(new StringToken(void 0, void 0, BOOLEAN, void 0));
      schema2.definitions[mappingDefinition.key] = mappingDefinition;
      mappingDefinition = new MappingDefinition(SEQUENCE_DEFINITION);
      mappingDefinition.properties[DESCRIPTION] = new PropertyDefinition(new StringToken(void 0, void 0, STRING, void 0));
      mappingDefinition.properties[CONTEXT] = new PropertyDefinition(new StringToken(void 0, void 0, SEQUENCE_OF_NON_EMPTY_STRING, void 0));
      mappingDefinition.properties[SEQUENCE] = new PropertyDefinition(new StringToken(void 0, void 0, SEQUENCE_DEFINITION_PROPERTIES, void 0));
      schema2.definitions[mappingDefinition.key] = mappingDefinition;
      mappingDefinition = new MappingDefinition(SEQUENCE_DEFINITION_PROPERTIES);
      mappingDefinition.properties[ITEM_TYPE] = new PropertyDefinition(new StringToken(void 0, void 0, NON_EMPTY_STRING, void 0));
      schema2.definitions[mappingDefinition.key] = mappingDefinition;
      mappingDefinition = new MappingDefinition(MAPPING_DEFINITION);
      mappingDefinition.properties[DESCRIPTION] = new PropertyDefinition(new StringToken(void 0, void 0, STRING, void 0));
      mappingDefinition.properties[CONTEXT] = new PropertyDefinition(new StringToken(void 0, void 0, SEQUENCE_OF_NON_EMPTY_STRING, void 0));
      mappingDefinition.properties[MAPPING] = new PropertyDefinition(new StringToken(void 0, void 0, MAPPING_DEFINITION_PROPERTIES, void 0));
      schema2.definitions[mappingDefinition.key] = mappingDefinition;
      mappingDefinition = new MappingDefinition(MAPPING_DEFINITION_PROPERTIES);
      mappingDefinition.properties[PROPERTIES] = new PropertyDefinition(new StringToken(void 0, void 0, PROPERTIES, void 0));
      mappingDefinition.properties[LOOSE_KEY_TYPE] = new PropertyDefinition(new StringToken(void 0, void 0, NON_EMPTY_STRING, void 0));
      mappingDefinition.properties[LOOSE_VALUE_TYPE] = new PropertyDefinition(new StringToken(void 0, void 0, NON_EMPTY_STRING, void 0));
      schema2.definitions[mappingDefinition.key] = mappingDefinition;
      mappingDefinition = new MappingDefinition(PROPERTIES);
      mappingDefinition.looseKeyType = NON_EMPTY_STRING;
      mappingDefinition.looseValueType = PROPERTY_VALUE;
      schema2.definitions[mappingDefinition.key] = mappingDefinition;
      oneOfDefinition = new OneOfDefinition(PROPERTY_VALUE);
      oneOfDefinition.oneOf.push(NON_EMPTY_STRING);
      oneOfDefinition.oneOf.push(MAPPING_PROPERTY_VALUE);
      schema2.definitions[oneOfDefinition.key] = oneOfDefinition;
      mappingDefinition = new MappingDefinition(MAPPING_PROPERTY_VALUE);
      mappingDefinition.properties[TYPE] = new PropertyDefinition(new StringToken(void 0, void 0, NON_EMPTY_STRING, void 0));
      mappingDefinition.properties[REQUIRED] = new PropertyDefinition(new StringToken(void 0, void 0, BOOLEAN, void 0));
      mappingDefinition.properties[DESCRIPTION] = new PropertyDefinition(new StringToken(void 0, void 0, STRING, void 0));
      schema2.definitions[mappingDefinition.key] = mappingDefinition;
      mappingDefinition = new MappingDefinition(ONE_OF_DEFINITION);
      mappingDefinition.properties[DESCRIPTION] = new PropertyDefinition(new StringToken(void 0, void 0, STRING, void 0));
      mappingDefinition.properties[CONTEXT] = new PropertyDefinition(new StringToken(void 0, void 0, SEQUENCE_OF_NON_EMPTY_STRING, void 0));
      mappingDefinition.properties[ONE_OF] = new PropertyDefinition(new StringToken(void 0, void 0, SEQUENCE_OF_NON_EMPTY_STRING, void 0));
      mappingDefinition.properties[ALLOWED_VALUES] = new PropertyDefinition(new StringToken(void 0, void 0, SEQUENCE_OF_NON_EMPTY_STRING, void 0));
      schema2.definitions[mappingDefinition.key] = mappingDefinition;
      const stringDefinition = new StringDefinition(NON_EMPTY_STRING);
      stringDefinition.requireNonEmpty = true;
      schema2.definitions[stringDefinition.key] = stringDefinition;
      const sequenceDefinition = new SequenceDefinition(SEQUENCE_OF_NON_EMPTY_STRING);
      sequenceDefinition.itemType = NON_EMPTY_STRING;
      schema2.definitions[sequenceDefinition.key] = sequenceDefinition;
      schema2.validate();
      _TemplateSchema._internalSchema = schema2;
    }
    return _TemplateSchema._internalSchema;
  }
};
TemplateSchema._definitionNamePattern = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;

// node_modules/@actions/workflow-parser/dist/workflow-v1.0.min.json
var workflow_v1_0_min_default = { version: "workflow-v1.0", definitions: { "workflow-root": { description: "A workflow file.", mapping: { properties: { on: "on", name: "workflow-name", description: "workflow-description", "run-name": "run-name", defaults: "workflow-defaults", env: "workflow-env", permissions: "permissions", concurrency: "workflow-concurrency", jobs: { type: "jobs", required: true } } } }, "workflow-root-strict": { description: "Workflow file with strict validation", mapping: { properties: { on: { type: "on-strict", required: true }, name: "workflow-name", description: "workflow-description", "run-name": "run-name", defaults: "workflow-defaults", env: "workflow-env", permissions: "permissions", concurrency: "workflow-concurrency", jobs: { type: "jobs", required: true } } } }, "workflow-name": { description: "The name of the workflow that GitHub displays on your repository's 'Actions' tab.\n\n[Documentation](https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions#name)", string: {} }, "workflow-description": { description: "A description for your workflow or reusable workflow", string: {} }, "run-name": { context: ["github", "inputs", "vars"], string: {}, description: "The name for workflow runs generated from the workflow. GitHub displays the workflow run name in the list of workflow runs on your repository's 'Actions' tab.\n\n[Documentation](https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions#run-name)" }, on: { description: "The GitHub event that triggers the workflow. Events can be a single string, array of events, array of event types, or an event configuration map that schedules a workflow or restricts the execution of a workflow to specific files, tags, or branch changes. View a full list of [events that trigger workflows](https://docs.github.com/actions/using-workflows/events-that-trigger-workflows).\n\n[Documentation](https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions#on)", "one-of": ["string", "sequence", "on-mapping"] }, "on-mapping": { mapping: { properties: { workflow_call: "workflow-call" }, "loose-key-type": "non-empty-string", "loose-value-type": "any" } }, "on-strict": { description: "The GitHub event that triggers the workflow.  Events can be a single string, array of events, array of event types, or an event configuration map that schedules a workflow or restricts the execution of a workflow to specific files, tags, or branch changes. View a full list of [events that trigger workflows](https://docs.github.com/actions/using-workflows/events-that-trigger-workflows).\n\n[Documentation](https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions#on)", "one-of": ["on-string-strict", "on-sequence-strict", "on-mapping-strict"] }, "on-mapping-strict": { description: "The GitHub event that triggers the workflow.  Events can be a single string, array of events, array of event types, or an event configuration map that schedules a workflow or restricts the execution of a workflow to specific files, tags, or branch changes. View a full list of [events that trigger workflows](https://docs.github.com/actions/using-workflows/events-that-trigger-workflows).\n\n[Documentation](https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions#on)", mapping: { properties: { branch_protection_rule: "branch-protection-rule", check_run: "check-run", check_suite: "check-suite", create: "create", delete: "delete", deployment: "deployment", deployment_status: "deployment-status", discussion: "discussion", discussion_comment: "discussion-comment", fork: "fork", gollum: "gollum", image_version: "image-version", issue_comment: "issue-comment", issues: "issues", label: "label", merge_group: "merge-group", milestone: "milestone", page_build: "page-build", project: "project", project_card: "project-card", project_column: "project-column", public: "public", pull_request: "pull-request", pull_request_comment: "pull-request-comment", pull_request_review: "pull-request-review", pull_request_review_comment: "pull-request-review-comment", pull_request_target: "pull-request-target", push: "push", registry_package: "registry-package", release: "release", repository_dispatch: "repository-dispatch", schedule: "schedule", status: "status", watch: "watch", workflow_call: "workflow-call", workflow_dispatch: "workflow-dispatch", workflow_run: "workflow-run" } } }, "on-string-strict": { "one-of": ["branch-protection-rule-string", "check-run-string", "check-suite-string", "create-string", "delete-string", "deployment-string", "deployment-status-string", "discussion-string", "discussion-comment-string", "fork-string", "gollum-string", "image-version-string", "issue-comment-string", "issues-string", "label-string", "merge-group-string", "milestone-string", "page-build-string", "project-string", "project-card-string", "project-column-string", "public-string", "pull-request-string", "pull-request-comment-string", "pull-request-review-string", "pull-request-review-comment-string", "pull-request-target-string", "push-string", "registry-package-string", "release-string", "repository-dispatch-string", "schedule-string", "status-string", "watch-string", "workflow-call-string", "workflow-dispatch-string", "workflow-run-string"] }, "on-sequence-strict": { sequence: { "item-type": "on-string-strict" } }, "branch-protection-rule-string": { description: "Runs your workflow when branch protection rules in the workflow repository are changed.", string: { constant: "branch_protection_rule" } }, "branch-protection-rule": { description: "Runs your workflow when branch protection rules in the workflow repository are changed.", "one-of": ["null", "branch-protection-rule-mapping"] }, "branch-protection-rule-mapping": { mapping: { properties: { types: "branch-protection-rule-activity" } } }, "branch-protection-rule-activity": { description: "The types of branch protection rule activity that trigger the workflow. Supported activity types: `created`, `edited`, `deleted`.", "one-of": ["branch-protection-rule-activity-type", "branch-protection-rule-activity-types"] }, "branch-protection-rule-activity-types": { sequence: { "item-type": "branch-protection-rule-activity-type" } }, "branch-protection-rule-activity-type": { "allowed-values": ["created", "edited", "deleted"] }, "check-run-string": { description: "Runs your workflow when activity related to a check run occurs. A check run is an individual test that is part of a check suite.", string: { constant: "check_run" } }, "check-run": { description: "Runs your workflow when activity related to a check run occurs. A check run is an individual test that is part of a check suite.", "one-of": ["null", "check-run-mapping"] }, "check-run-mapping": { mapping: { properties: { types: "check-run-activity" } } }, "check-run-activity": { description: "The types of check run activity that trigger the workflow. Supported activity types: `created`, `rerequested`, `completed`, `requested_action`.", "one-of": ["check-run-activity-type", "check-run-activity-types"] }, "check-run-activity-types": { sequence: { "item-type": "check-run-activity-type" } }, "check-run-activity-type": { "allowed-values": ["completed", "created", "rerequested", "requested_action"] }, "check-suite-string": { description: "Runs your workflow when check suite activity occurs. A check suite is a collection of the check runs created for a specific commit. Check suites summarize the status and conclusion of the check runs that are in the suite.", string: { constant: "check_suite" } }, "check-suite": { description: "Runs your workflow when check suite activity occurs. A check suite is a collection of the check runs created for a specific commit. Check suites summarize the status and conclusion of the check runs that are in the suite.", "one-of": ["null", "check-suite-mapping"] }, "check-suite-mapping": { mapping: { properties: { types: "check-suite-activity" } } }, "check-suite-activity": { description: "The types of check suite activity that trigger the workflow. Supported activity types: `completed`.", "one-of": ["check-suite-activity-type", "check-suite-activity-types"] }, "check-suite-activity-types": { sequence: { "item-type": "check-suite-activity-type" } }, "check-suite-activity-type": { "allowed-values": ["completed"] }, "create-string": { description: "Runs your workflow when someone creates a Git reference (Git branch or tag) in the workflow's repository.", string: { constant: "create" } }, create: { description: "Runs your workflow when someone creates a Git reference (Git branch or tag) in the workflow's repository.", null: {} }, "delete-string": { description: "Runs your workflow when someone deletes a Git reference (Git branch or tag) in the workflow's repository.", string: { constant: "delete" } }, delete: { description: "Runs your workflow when someone deletes a Git reference (Git branch or tag) in the workflow's repository.", null: {} }, "deployment-string": { description: "Runs your workflow when someone creates a deployment in the workflow's repository. Deployments created with a commit SHA may not have a Git ref.", string: { constant: "deployment" } }, deployment: { description: "Runs your workflow when someone creates a deployment in the workflow's repository. Deployments created with a commit SHA may not have a Git ref.", null: {} }, "deployment-status-string": { description: "Runs your workflow when a third party provides a deployment status. Deployments created with a commit SHA may not have a Git ref.", string: { constant: "deployment_status" } }, "deployment-status": { description: "Runs your workflow when a third party provides a deployment status. Deployments created with a commit SHA may not have a Git ref.", null: {} }, "discussion-string": { description: "Runs your workflow when a discussion in the workflow's repository is created or modified. For activity related to comments on a discussion, use the `discussion_comment` event.", string: { constant: "discussion" } }, discussion: { description: "Runs your workflow when a discussion in the workflow's repository is created or modified. For activity related to comments on a discussion, use the `discussion_comment` event.", "one-of": ["null", "discussion-mapping"] }, "discussion-mapping": { mapping: { properties: { types: "discussion-activity" } } }, "discussion-activity": { description: "The types of discussion activity that trigger the workflow. Supported activity types: `created`, `edited`, `deleted`, `transferred`, `pinned`, `unpinned`, `labeled`, `unlabeled`, `locked`, `unlocked`, `category_changed`, `answered`, `unanswered`.", "one-of": ["discussion-activity-type", "discussion-activity-types"] }, "discussion-activity-types": { sequence: { "item-type": "discussion-activity-type" } }, "discussion-activity-type": { "allowed-values": ["created", "edited", "deleted", "transferred", "pinned", "unpinned", "labeled", "unlabeled", "locked", "unlocked", "category_changed", "answered", "unanswered"] }, "discussion-comment-string": { description: "Runs your workflow when a comment on a discussion in the workflow's repository is created or modified. For activity related to a discussion as opposed to comments on the discussion, use the `discussion` event.", string: { constant: "discussion_comment" } }, "discussion-comment": { description: "Runs your workflow when a comment on a discussion in the workflow's repository is created or modified. For activity related to a discussion as opposed to comments on the discussion, use the `discussion` event.", "one-of": ["null", "discussion-comment-mapping"] }, "discussion-comment-mapping": { mapping: { properties: { types: "discussion-comment-activity" } } }, "discussion-comment-activity": { description: "The types of discussion comment activity that trigger the workflow. Supported activity types: `created`, `edited`, `deleted`.", "one-of": ["discussion-comment-activity-type", "discussion-comment-activity-types"] }, "discussion-comment-activity-types": { sequence: { "item-type": "discussion-comment-activity-type" } }, "discussion-comment-activity-type": { "allowed-values": ["created", "edited", "deleted"] }, "fork-string": { description: "Runs your workflow when someone forks a repository.", string: { constant: "fork" } }, fork: { description: "Runs your workflow when someone forks a repository.", null: {} }, "gollum-string": { description: "Runs your workflow when someone creates or updates a Wiki page.", string: { constant: "gollum" } }, gollum: { description: "Runs your workflow when someone creates or updates a Wiki page.", null: {} }, "image-version-string": { description: "Runs your workflow when an image version is created or changes state.", string: { constant: "image_version" } }, "image-version": { description: "Runs your workflow when an image version is created or changes state.", "one-of": ["null", "image-version-mapping"] }, "image-version-mapping": { mapping: { properties: { types: "image-version-activity", names: "event-names", versions: "event-versions" } } }, "image-version-activity": { description: "The types of image version activity that trigger the workflow. Supported activity types: `created`, `ready`, `deleted`.", "one-of": ["image-version-activity-type", "image-version-activity-types"] }, "image-version-activity-types": { sequence: { "item-type": "image-version-activity-type" } }, "image-version-activity-type": { "allowed-values": ["created", "ready", "deleted"] }, "issue-comment-string": { description: "Runs your workflow when an issue or pull request comment is created, edited, or deleted.", string: { constant: "issue_comment" } }, "issue-comment": { description: "Runs your workflow when an issue or pull request comment is created, edited, or deleted.", "one-of": ["null", "issue-comment-mapping"] }, "issue-comment-mapping": { mapping: { properties: { types: "issue-comment-activity" } } }, "issue-comment-activity": { description: "The types of issue comment activity that trigger the workflow. Supported activity types: `created`, `edited`, `deleted`.", "one-of": ["issue-comment-activity-type", "issue-comment-activity-types"] }, "issue-comment-activity-types": { sequence: { "item-type": "issue-comment-activity-type" } }, "issue-comment-activity-type": { "allowed-values": ["created", "edited", "deleted"] }, "issues-string": { description: "Runs your workflow when an issue in the workflow's repository is created or modified. For activity related to comments in an issue, use the `issue_comment` event.", string: { constant: "issues" } }, issues: { description: "Runs your workflow when an issue in the workflow's repository is created or modified. For activity related to comments in an issue, use the `issue_comment` event.", "one-of": ["null", "issues-mapping"] }, "issues-mapping": { mapping: { properties: { types: "issues-activity" } } }, "issues-activity": { description: "The types of issue activity that trigger the workflow. Supported activity types: `opened`, `edited`, `deleted`, `transferred`, `pinned`, `unpinned`, `closed`, `reopened`, `assigned`, `unassigned`, `labeled`, `unlabeled`, `locked`, `unlocked`, `milestoned`, `demilestoned`, `field_added`, `field_removed`, `typed`, `untyped`.", "one-of": ["issues-activity-type", "issues-activity-types"] }, "issues-activity-types": { sequence: { "item-type": "issues-activity-type" } }, "issues-activity-type": { "allowed-values": ["opened", "edited", "deleted", "transferred", "pinned", "unpinned", "closed", "reopened", "assigned", "unassigned", "labeled", "unlabeled", "locked", "unlocked", "milestoned", "demilestoned", "field_added", "field_removed", "typed", "untyped"] }, "label-string": { description: "Runs your workflow when a label in your workflow's repository is created or modified.", string: { constant: "label" } }, label: { description: "Runs your workflow when a label in your workflow's repository is created or modified.", "one-of": ["null", "label-mapping"] }, "label-mapping": { mapping: { properties: { types: "label-activity" } } }, "label-activity": { description: "The types of label activity that trigger the workflow. Supported activity types: `created`, `edited`, `deleted`.", "one-of": ["label-activity-type", "label-activity-types"] }, "label-activity-types": { sequence: { "item-type": "label-activity-type" } }, "label-activity-type": { "allowed-values": ["created", "edited", "deleted"] }, "merge-group-string": { description: "Runs your workflow when a pull request is added to a merge queue, which adds the pull request to a merge group.", string: { constant: "merge_group" } }, "merge-group": { description: "Runs your workflow when a pull request is added to a merge queue, which adds the pull request to a merge group.", "one-of": ["null", "merge-group-mapping"] }, "merge-group-mapping": { mapping: { properties: { types: "merge-group-activity", branches: "event-branches", "branches-ignore": "event-branches-ignore" } } }, "merge-group-activity": { description: "The types of merge group activity that trigger the workflow. Supported activity types: `checks_requested`.", "one-of": ["merge-group-activity-type", "merge-group-activity-types"] }, "merge-group-activity-types": { sequence: { "item-type": "merge-group-activity-type" } }, "merge-group-activity-type": { "allowed-values": ["checks_requested"] }, "milestone-string": { description: "Runs your workflow when a milestone in the workflow's repository is created or modified.", string: { constant: "milestone" } }, milestone: { description: "Runs your workflow when a milestone in the workflow's repository is created or modified.", "one-of": ["null", "milestone-mapping"] }, "milestone-mapping": { mapping: { properties: { types: "milestone-activity" } } }, "milestone-activity": { description: "The types of milestone activity that trigger the workflow. Supported activity types: `created`, `closed`, `opened`, `edited`, `deleted`.", "one-of": ["milestone-activity-type", "milestone-activity-types"] }, "milestone-activity-types": { sequence: { "item-type": "milestone-activity-type" } }, "milestone-activity-type": { "allowed-values": ["created", "closed", "opened", "edited", "deleted"] }, "page-build-string": { description: "Runs your workflow when someone pushes to a branch that is the publishing source for GitHub Pages, if GitHub Pages is enabled for the repository.", string: { constant: "page_build" } }, "page-build": { description: "Runs your workflow when someone pushes to a branch that is the publishing source for GitHub Pages, if GitHub Pages is enabled for the repository.", null: {} }, "project-string": { description: "Runs your workflow when a project board is created or modified. For activity related to cards or columns in a project board, use the `project_card` or `project_column` events instead.", string: { constant: "project" } }, project: { description: "Runs your workflow when a project board is created or modified. For activity related to cards or columns in a project board, use the `project_card` or `project_column` events instead.", "one-of": ["null", "project-mapping"] }, "project-mapping": { mapping: { properties: { types: "project-activity" } } }, "project-activity": { description: "The types of project activity that trigger the workflow. Supported activity types: `created`, `closed`, `reopened`, `edited`, `deleted`.", "one-of": ["project-activity-type", "project-activity-types"] }, "project-activity-types": { sequence: { "item-type": "project-activity-type" } }, "project-activity-type": { "allowed-values": ["created", "closed", "reopened", "edited", "deleted"] }, "project-card-string": { description: "Runs your workflow when a card on a project board is created or modified. For activity related to project boards or columns in a project board, use the `project` or `project_column` event instead.", string: { constant: "project_card" } }, "project-card": { description: "Runs your workflow when a card on a project board is created or modified. For activity related to project boards or columns in a project board, use the `project` or `project_column` event instead.", "one-of": ["null", "project-card-mapping"] }, "project-card-mapping": { mapping: { properties: { types: "project-card-activity" } } }, "project-card-activity": { description: "The types of project card activity that trigger the workflow. Supported activity types: `created`, `moved`, `converted`, `edited`, `deleted`.", "one-of": ["project-card-activity-type", "project-card-activity-types"] }, "project-card-activity-types": { sequence: { "item-type": "project-card-activity-type" } }, "project-card-activity-type": { "allowed-values": ["created", "moved", "converted", "edited", "deleted"] }, "project-column-string": { description: "Runs your workflow when a column on a project board is created or modified. For activity related to project boards or cards in a project board, use the `project` or `project_card` event instead.", string: { constant: "project_column" } }, "project-column": { description: "Runs your workflow when a column on a project board is created or modified. For activity related to project boards or cards in a project board, use the `project` or `project_card` event instead.", "one-of": ["null", "project-column-mapping"] }, "project-column-mapping": { mapping: { properties: { types: "project-column-activity" } } }, "project-column-activity": { description: "The types of project column activity that trigger the workflow. Supported activity types: `created`, `updated`, `moved`, `deleted`.", "one-of": ["project-column-activity-type", "project-column-activity-types"] }, "project-column-activity-types": { sequence: { "item-type": "project-column-activity-type" } }, "project-column-activity-type": { "allowed-values": ["created", "updated", "moved", "deleted"] }, "public-string": { description: "Runs your workflow when your workflow's repository changes from private to public.", string: { constant: "public" } }, public: { description: "Runs your workflow when your workflow's repository changes from private to public.", null: {} }, "pull-request-string": { description: "Runs your workflow when activity on a pull request in the workflow's repository occurs. If no activity types are specified, the workflow runs when a pull request is opened, reopened, or when the head branch of the pull request is updated.", string: { constant: "pull_request" } }, "pull-request": { description: "Runs your workflow when activity on a pull request in the workflow's repository occurs. If no activity types are specified, the workflow runs when a pull request is opened, reopened, or when the head branch of the pull request is updated.", "one-of": ["null", "pull-request-mapping"] }, "pull-request-mapping": { mapping: { properties: { types: "pull-request-activity", branches: "event-branches", "branches-ignore": "event-branches-ignore", paths: "event-paths", "paths-ignore": "event-paths-ignore" } } }, "pull-request-activity": { description: "The types of pull request activity that trigger the workflow. Supported activity types: `assigned`, `unassigned`, `labeled`, `unlabeled`, `opened`, `edited`, `closed`, `reopened`, `synchronize`, `converted_to_draft`, `locked`, `unlocked`, `enqueued`, `dequeued`, `milestoned`, `demilestoned`, `ready_for_review`, `review_requested`, `review_request_removed`, `auto_merge_enabled`, `auto_merge_disabled`, `stacked`.", "one-of": ["pull-request-activity-type", "pull-request-activity-types"] }, "pull-request-activity-types": { sequence: { "item-type": "pull-request-activity-type" } }, "pull-request-activity-type": { "allowed-values": ["assigned", "unassigned", "labeled", "unlabeled", "opened", "edited", "closed", "reopened", "synchronize", "converted_to_draft", "locked", "unlocked", "enqueued", "dequeued", "milestoned", "demilestoned", "ready_for_review", "review_requested", "review_request_removed", "auto_merge_enabled", "auto_merge_disabled", "stacked"] }, "pull-request-comment-string": { description: "Please use the `issue_comment` event instead.", string: { constant: "pull_request_comment" } }, "pull-request-comment": { description: "Please use the `issue_comment` event instead.", "one-of": ["null", "issue-comment-mapping"] }, "pull-request-review-string": { description: "Runs your workflow when a pull request review is submitted, edited, or dismissed. A pull request review is a group of pull request review comments in addition to a body comment and a state. For activity related to pull request review comments or pull request comments, use the `pull_request_review_comment` or `issue_comment` events instead.", string: { constant: "pull_request_review" } }, "pull-request-review": { description: "Runs your workflow when a pull request review is submitted, edited, or dismissed. A pull request review is a group of pull request review comments in addition to a body comment and a state. For activity related to pull request review comments or pull request comments, use the `pull_request_review_comment` or `issue_comment` events instead.", "one-of": ["null", "pull-request-review-mapping"] }, "pull-request-review-mapping": { mapping: { properties: { types: "pull-request-review-activity" } } }, "pull-request-review-activity": { description: "The types of pull request review activity that trigger the workflow. Supported activity types: `submitted`, `edited`, `dismissed`.", "one-of": ["pull-request-review-activity-type", "pull-request-review-activity-types"] }, "pull-request-review-activity-types": { sequence: { "item-type": "pull-request-review-activity-type" } }, "pull-request-review-activity-type": { "allowed-values": ["submitted", "edited", "dismissed"] }, "pull-request-review-comment-string": { description: "", string: { constant: "pull_request_review_comment" } }, "pull-request-review-comment": { description: "", "one-of": ["null", "pull-request-review-comment-mapping"] }, "pull-request-review-comment-mapping": { mapping: { properties: { types: "pull-request-review-comment-activity" } } }, "pull-request-review-comment-activity": { description: "The types of pull request review comment activity that trigger the workflow. Supported activity types: `created`, `edited`, `deleted`.", "one-of": ["pull-request-review-comment-activity-type", "pull-request-review-comment-activity-types"] }, "pull-request-review-comment-activity-types": { sequence: { "item-type": "pull-request-review-comment-activity-type" } }, "pull-request-review-comment-activity-type": { "allowed-values": ["created", "edited", "deleted"] }, "pull-request-target-string": { description: "Runs your workflow when activity on a pull request in the workflow's repository occurs. If no activity types are specified, the workflow runs when a pull request is opened, reopened, or when the head branch of the pull request is updated.\n\nThis event runs in the context of the base of the pull request, rather than in the context of the merge commit, as the `pull_request` event does. This prevents execution of unsafe code from the head of the pull request that could alter your repository or steal any secrets you use in your workflow. This event allows your workflow to do things like label or comment on pull requests from forks. Avoid using this event if you need to build or run code from the pull request.", string: { constant: "pull_request_target" } }, "pull-request-target": { description: "Runs your workflow when activity on a pull request in the workflow's repository occurs. If no activity types are specified, the workflow runs when a pull request is opened, reopened, or when the head branch of the pull request is updated.\n\nThis event runs in the context of the base of the pull request, rather than in the context of the merge commit, as the `pull_request` event does. This prevents execution of unsafe code from the head of the pull request that could alter your repository or steal any secrets you use in your workflow. This event allows your workflow to do things like label or comment on pull requests from forks. Avoid using this event if you need to build or run code from the pull request.", "one-of": ["null", "pull-request-target-mapping"] }, "pull-request-target-mapping": { mapping: { properties: { types: "pull-request-target-activity", branches: "event-branches", "branches-ignore": "event-branches-ignore", paths: "event-paths", "paths-ignore": "event-paths-ignore" } } }, "pull-request-target-activity": { description: "The types of pull request activity that trigger the workflow. Supported activity types: `assigned`, `unassigned`, `labeled`, `unlabeled`, `opened`, `edited`, `closed`, `reopened`, `synchronize`, `converted_to_draft`, `locked`, `unlocked`, `enqueued`, `dequeued`, `milestoned`, `demilestoned`, `ready_for_review`, `review_requested`, `review_request_removed`, `auto_merge_enabled`, `auto_merge_disabled`, `stacked`.", "one-of": ["pull-request-target-activity-type", "pull-request-target-activity-types"] }, "pull-request-target-activity-types": { sequence: { "item-type": "pull-request-target-activity-type" } }, "pull-request-target-activity-type": { "allowed-values": ["assigned", "unassigned", "labeled", "unlabeled", "opened", "edited", "closed", "reopened", "synchronize", "converted_to_draft", "locked", "unlocked", "enqueued", "dequeued", "milestoned", "demilestoned", "ready_for_review", "review_requested", "review_request_removed", "auto_merge_enabled", "auto_merge_disabled", "stacked"] }, "push-string": { description: "Runs your workflow when you push a commit or tag.", string: { constant: "push" } }, push: { description: "Runs your workflow when you push a commit or tag.", "one-of": ["null", "push-mapping"] }, "push-mapping": { mapping: { properties: { branches: "event-branches", "branches-ignore": "event-branches-ignore", tags: "event-tags", "tags-ignore": "event-tags-ignore", paths: "event-paths", "paths-ignore": "event-paths-ignore" } } }, "registry-package-string": { description: "Runs your workflow when activity related to GitHub Packages occurs in your repository.", string: { constant: "registry_package" } }, "registry-package": { description: "Runs your workflow when activity related to GitHub Packages occurs in your repository.", "one-of": ["null", "registry-package-mapping"] }, "registry-package-mapping": { mapping: { properties: { types: "registry-package-activity" } } }, "registry-package-activity": { description: "The types of registry package activity that trigger the workflow. Supported activity types: `published`, `updated`.", "one-of": ["registry-package-activity-type", "registry-package-activity-types"] }, "registry-package-activity-types": { sequence: { "item-type": "registry-package-activity-type" } }, "registry-package-activity-type": { "allowed-values": ["published", "updated"] }, "release-string": { description: "Runs your workflow when release activity in your repository occurs.", string: { constant: "release" } }, release: { description: "Runs your workflow when release activity in your repository occurs.", "one-of": ["null", "release-mapping"] }, "release-mapping": { mapping: { properties: { types: "release-activity" } } }, "release-activity": { description: "The types of release activity that trigger the workflow. Supported activity types: `published`, `unpublished`, `created`, `edited`, `deleted`, `prereleased`, `released`.", "one-of": ["release-activity-type", "release-activity-types"] }, "release-activity-types": { sequence: { "item-type": "release-activity-type" } }, "release-activity-type": { "allowed-values": ["published", "unpublished", "created", "edited", "deleted", "prereleased", "released"] }, "schedule-string": { description: "The `schedule` event allows you to trigger a workflow at a scheduled time.\n\nYou can schedule a workflow to run at specific UTC times using POSIX cron syntax. Scheduled workflows run on the latest commit on the default or base branch. The shortest interval you can run scheduled workflows is once every 5 minutes. GitHub Actions does not support the non-standard syntax `@yearly`, `@monthly`, `@weekly`, `@daily`, `@hourly`, and `@reboot`.", string: { constant: "schedule" } }, schedule: { description: "The `schedule` event allows you to trigger a workflow at a scheduled time.\n\nYou can schedule a workflow to run at specific UTC times using POSIX cron syntax. Scheduled workflows run on the latest commit on the default or base branch. The shortest interval you can run scheduled workflows is once every 5 minutes. GitHub Actions does not support the non-standard syntax `@yearly`, `@monthly`, `@weekly`, `@daily`, `@hourly`, and `@reboot`.", sequence: { "item-type": "cron-mapping" } }, "status-string": { description: "Runs your workflow when the status of a Git commit changes. For example, commits can be marked as `error`, `failure`, `pending`, or `success`. If you want to provide more details about the status change, you may want to use the `check_run` event.", string: { constant: "status" } }, status: { description: "Runs your workflow when the status of a Git commit changes. For example, commits can be marked as `error`, `failure`, `pending`, or `success`. If you want to provide more details about the status change, you may want to use the `check_run` event.", null: {} }, "watch-string": { description: "Runs your workflow when the workflow's repository is starred.", string: { constant: "watch" } }, watch: { description: "Runs your workflow when the workflow's repository is starred.", "one-of": ["null", "watch-mapping"] }, "watch-mapping": { mapping: { properties: { types: "watch-activity" } } }, "watch-activity": { description: "The types of watch activity that trigger the workflow. Supported activity types: `started`.", "one-of": ["watch-activity-type", "watch-activity-types"] }, "watch-activity-types": { sequence: { "item-type": "watch-activity-type" } }, "watch-activity-type": { "allowed-values": ["started"] }, "workflow-run-string": { description: "This event occurs when a workflow run is requested or completed. It allows you to execute a workflow based on execution or completion of another workflow. The workflow started by the `workflow_run` event is able to access secrets and write tokens, even if the previous workflow was not. This is useful in cases where the previous workflow is intentionally not privileged, but you need to take a privileged action in a later workflow.", string: { constant: "workflow_run" } }, "workflow-run": { description: "This event occurs when a workflow run is requested or completed. It allows you to execute a workflow based on execution or completion of another workflow. The workflow started by the `workflow_run` event is able to access secrets and write tokens, even if the previous workflow was not. This is useful in cases where the previous workflow is intentionally not privileged, but you need to take a privileged action in a later workflow.", "one-of": ["null", "workflow-run-mapping"] }, "workflow-run-mapping": { mapping: { properties: { types: "workflow-run-activity", workflows: "workflow-run-workflows", branches: "event-branches", "branches-ignore": "event-branches-ignore" } } }, "workflow-run-workflows": { description: "The name of the workflow that triggers the `workflow_run` event. The workflow must be in the same repository as the workflow that uses the `workflow_run` event.", "one-of": ["non-empty-string", "sequence-of-non-empty-string"] }, "workflow-run-activity": { description: "The types of workflow run activity that trigger the workflow. Supported activity types: `completed`, `requested`, `in_progress`.", "one-of": ["workflow-run-activity-type", "workflow-run-activity-types"] }, "workflow-run-activity-types": { sequence: { "item-type": "workflow-run-activity-type" } }, "workflow-run-activity-type": { "allowed-values": ["requested", "completed", "in_progress"] }, "event-branches": { description: "Use the `branches` filter when you want to include branch name patterns or when you want to both include and exclude branch name patterns. You cannot use both the `branches` and `branches-ignore` filters for the same event in a workflow.", "one-of": ["non-empty-string", "sequence-of-non-empty-string"] }, "event-branches-ignore": { description: "Use the `branches-ignore` filter when you only want to exclude branch name patterns. You cannot use both the `branches` and `branches-ignore` filters for the same event in a workflow.", "one-of": ["non-empty-string", "sequence-of-non-empty-string"] }, "event-names": { description: "Use the `names` filter when you want to include names via patterns or when you want to both include and exclude names using patterns. ", "one-of": ["non-empty-string", "sequence-of-non-empty-string"] }, "event-tags": { description: "Use the `tags` filter when you want to include tag name patterns or when you want to both include and exclude tag names patterns. You cannot use both the `tags` and `tags-ignore` filters for the same event in a workflow.", "one-of": ["non-empty-string", "sequence-of-non-empty-string"] }, "event-tags-ignore": { description: "Use the `tags-ignore` filter when you only want to exclude tag name patterns. You cannot use both the `tags` and `tags-ignore` filters for the same event in a workflow.", "one-of": ["non-empty-string", "sequence-of-non-empty-string"] }, "event-paths": { description: "Use the `paths` filter when you want to include file path patterns or when you want to both include and exclude file path patterns. You cannot use both the `paths` and `paths-ignore` filters for the same event in a workflow.", "one-of": ["non-empty-string", "sequence-of-non-empty-string"] }, "event-paths-ignore": { description: "Use the `paths-ignore` filter when you only want to exclude file path patterns. You cannot use both the `paths` and `paths-ignore` filters for the same event in a workflow.", "one-of": ["non-empty-string", "sequence-of-non-empty-string"] }, "event-versions": { description: "Use the `versions` filter when you want to include versions via patterns or when you want to both include and exclude versions using patterns. ", "one-of": ["non-empty-string", "sequence-of-non-empty-string"] }, "repository-dispatch-string": { description: "You can use the GitHub API to trigger a webhook event called `repository_dispatch` when you want to trigger a workflow for activity that happens outside of GitHub.", string: { constant: "branch_protection_rule" } }, "repository-dispatch": { description: "You can use the GitHub API to trigger a webhook event called `repository_dispatch` when you want to trigger a workflow for activity that happens outside of GitHub.", "one-of": ["null", "repository-dispatch-mapping"] }, "repository-dispatch-mapping": { mapping: { properties: { types: "sequence-of-non-empty-string" } } }, "workflow-call-string": { description: "The `workflow_call` event is used to indicate that a workflow can be called by another workflow. When a workflow is triggered with the `workflow_call` event, the event payload in the called workflow is the same event payload from the calling workflow.", string: { constant: "workflow_call" } }, "workflow-call": { description: "The `workflow_call` event is used to indicate that a workflow can be called by another workflow. When a workflow is triggered with the `workflow_call` event, the event payload in the called workflow is the same event payload from the calling workflow.", "one-of": ["null", "workflow-call-mapping"] }, "workflow-call-mapping": { mapping: { properties: { inputs: "workflow-call-inputs", secrets: "workflow-call-secrets", outputs: "workflow-call-outputs" } } }, "workflow-call-inputs": { description: "Inputs that are passed to the called workflow from the caller workflow.", mapping: { "loose-key-type": "non-empty-string", "loose-value-type": "workflow-call-input-definition" } }, "workflow-call-input-definition": { mapping: { properties: { description: { type: "string", description: "A string description of the input parameter." }, type: { type: "workflow-call-input-type", required: true }, required: { type: "boolean", description: "A boolean to indicate whether the action requires the input parameter. Set to `true` when the parameter is required." }, default: "workflow-call-input-default" } } }, "workflow-call-input-type": { description: "Required if input is defined for the `on.workflow_call` keyword. The value of this parameter is a string specifying the data type of the input. This must be one of: `boolean`, `number`, or `string`.", "one-of": ["input-type-string", "input-type-boolean", "input-type-number"] }, "input-type-string": { string: { constant: "string" } }, "input-type-boolean": { string: { constant: "boolean" } }, "input-type-number": { string: { constant: "number" } }, "input-type-choice": { string: { constant: "choice" } }, "input-type-environment": { string: { constant: "environment" } }, "workflow-call-input-default": { description: 'If a `default` parameter is not set, the default value of the input is `false` for boolean, `0` for a number, and `""` for a string.', context: ["github", "inputs", "vars"], "one-of": ["string", "boolean", "number"] }, "workflow-call-secrets": { description: "A map of the secrets that can be used in the called workflow. Within the called workflow, you can use the `secrets` context to refer to a secret.", mapping: { "loose-key-type": "workflow-call-secret-name", "loose-value-type": "workflow-call-secret-definition" } }, "workflow-call-secret-name": { string: { "require-non-empty": true }, description: "A string identifier to associate with the secret." }, "workflow-call-secret-definition": { "one-of": ["null", "workflow-call-secret-mapping-definition"] }, "workflow-call-secret-mapping-definition": { mapping: { properties: { description: { type: "string", description: "A string description of the secret parameter." }, required: { type: "boolean", description: "A boolean specifying whether the secret must be supplied." } } } }, "workflow-call-outputs": { description: "A reusable workflow may generate data that you want to use in the caller workflow. To use these outputs, you must specify them as the outputs of the reusable workflow.", mapping: { "loose-key-type": "workflow-call-output-name", "loose-value-type": "workflow-call-output-definition" } }, "workflow-call-output-name": { string: { "require-non-empty": true }, description: "A string identifier to associate with the output. The value of `<output_id>` is a map of the input's metadata. The `<output_id>` must be a unique identifier within the outputs object and must start with a letter or _ and contain only alphanumeric characters, -, or _." }, "workflow-call-output-definition": { mapping: { properties: { description: { type: "string", description: "A string description of the output parameter." }, value: { type: "workflow-output-context", required: true } } } }, "workflow-output-context": { description: "The value to assign to the output parameter.", context: ["github", "inputs", "vars", "jobs"], string: {} }, "workflow-dispatch-string": { description: "The `workflow_dispatch` event allows you to manually trigger a workflow run. A workflow can be manually triggered using the GitHub API, GitHub CLI, or GitHub browser interface.", string: { constant: "workflow_dispatch" } }, "workflow-dispatch": { description: "The `workflow_dispatch` event allows you to manually trigger a workflow run. A workflow can be manually triggered using the GitHub API, GitHub CLI, or GitHub browser interface.", "one-of": ["null", "workflow-dispatch-mapping"] }, "workflow-dispatch-mapping": { mapping: { properties: { inputs: "workflow-dispatch-inputs" } } }, "workflow-dispatch-inputs": { description: "You can configure custom-defined input properties, default input values, and required inputs for the event directly in your workflow. When you trigger the event, you can provide the `ref` and any `inputs`. When the workflow runs, you can access the input values in the `inputs` context.", mapping: { "loose-key-type": "workflow-dispatch-input-name", "loose-value-type": "workflow-dispatch-input" } }, "workflow-dispatch-input-name": { string: { "require-non-empty": true }, description: "A string identifier to associate with the input. The value of <input_id> is a map of the input's metadata. The <input_id> must be a unique identifier within the inputs object. The <input_id> must start with a letter or _ and contain only alphanumeric characters, -, or _." }, "workflow-dispatch-input": { mapping: { properties: { description: { type: "string", description: "A string description of the input parameter." }, type: { type: "workflow-dispatch-input-type" }, required: { type: "boolean", description: "A boolean to indicate whether the workflow requires the input parameter. Set to true when the parameter is required." }, default: "workflow-dispatch-input-default", options: { type: "sequence-of-string", description: "The options of the dropdown list, if the type is a choice." } } } }, "workflow-dispatch-input-type": { description: "A string representing the type of the input. This must be one of: `boolean`, `number`, `string`, `choice`, or `environment`.", "one-of": ["input-type-string", "input-type-boolean", "input-type-number", "input-type-environment", "input-type-choice"] }, "workflow-dispatch-input-default": { description: "The default value is used when an input parameter isn't specified in a workflow file.", "one-of": ["string", "boolean", "number"] }, permissions: { description: "You can use `permissions` to modify the default permissions granted to the `GITHUB_TOKEN`, adding or removing access as required, so that you only allow the minimum required access.\n\n[Documentation](https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions#permissions)", "one-of": ["permissions-mapping", "permission-level-shorthand-read-all", "permission-level-shorthand-write-all"] }, "permissions-mapping": { mapping: { properties: { actions: { type: "permission-level-any", description: "Actions workflows, workflow runs, and artifacts." }, "artifact-metadata": { type: "permission-level-any", description: "Storage and deployment records for build artifacts." }, attestations: { type: "permission-level-any", description: "Artifact attestations." }, checks: { type: "permission-level-any", description: "Check runs and check suites." }, "code-quality": { type: "permission-level-any", description: "Code quality data." }, contents: { type: "permission-level-any", description: "Repository contents, commits, branches, downloads, releases, and merges." }, "copilot-requests": { type: "permission-level-write-or-no-access", description: "GitHub Copilot requests." }, deployments: { type: "permission-level-any", description: "Deployments and deployment statuses." }, discussions: { type: "permission-level-any", description: "Discussions and related comments and labels." }, drives: { type: "permission-level-any", description: "GitHub Drives persistent workspace storage. Use `read` for checkout and `write` to commit changes." }, "id-token": { type: "permission-level-write-or-no-access", description: "Token to request an OpenID Connect token." }, issues: { type: "permission-level-any", description: "Issues and related comments, assignees, labels, and milestones." }, models: { type: "permission-level-read-or-no-access", description: "Call AI models with GitHub Models." }, packages: { type: "permission-level-any", description: "Packages published to the GitHub Package Platform." }, pages: { type: "permission-level-any", description: "Retrieve Pages statuses, configuration, and builds, as well as create new builds." }, "pull-requests": { type: "permission-level-any", description: "Pull requests and related comments, assignees, labels, milestones, and merges." }, "repository-projects": { type: "permission-level-any", description: "Classic projects within a repository." }, "security-events": { type: "permission-level-any", description: "Code scanning alerts." }, statuses: { type: "permission-level-any", description: "Commit statuses." }, "vulnerability-alerts": { type: "permission-level-read-or-no-access", description: "Dependabot alerts." } } } }, "permission-level-any": { description: "The permission level for the `GITHUB_TOKEN`.", "one-of": ["permission-level-read", "permission-level-write", "permission-level-no-access"] }, "permission-level-read-or-no-access": { "one-of": ["permission-level-read", "permission-level-no-access"] }, "permission-level-write-or-no-access": { "one-of": ["permission-level-write", "permission-level-no-access"] }, "permission-level-read": { description: "The permission level for the `GITHUB_TOKEN`. Grants `read` permission for the specified scope.", string: { constant: "read" } }, "permission-level-write": { description: "The permission level for the `GITHUB_TOKEN`. Grants `write` permission for the specified scope.", string: { constant: "write" } }, "permission-level-no-access": { description: "The permission level for the `GITHUB_TOKEN`. Restricts all access for the specified scope.", string: { constant: "none" } }, "permission-level-shorthand-read-all": { description: "The permission level for the `GITHUB_TOKEN`. Grants `read` access for all scopes.", string: { constant: "read-all" } }, "permission-level-shorthand-write-all": { description: "The permission level for the `GITHUB_TOKEN`. Grants `write` access for all scopes.", string: { constant: "write-all" } }, "workflow-defaults": { description: "Use `defaults` to create a map of default settings that will apply to all jobs in the workflow. You can also set default settings that are only available to a job.\n\n[Documentation](https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions#defaults)", mapping: { properties: { run: "workflow-defaults-run" } } }, "workflow-defaults-run": { mapping: { properties: { shell: "shell", "working-directory": "working-directory" } } }, "workflow-env": { description: "A map of environment variables that are available to the steps of all jobs in the workflow. You can also set environment variables that are only available to the steps of a single job or to a single step.\n\n[Documentation](https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions#env)", context: ["github", "inputs", "vars", "secrets"], mapping: { "loose-key-type": "non-empty-string", "loose-value-type": "string" } }, jobs: { description: "A workflow run is made up of one or more `jobs`, which run in parallel by default. To run jobs sequentially, you can define dependencies on other jobs using the `jobs.<job_id>.needs` keyword. Each job runs in a runner environment specified by `runs-on`.\n\n[Documentation](https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions#jobs)", mapping: { "loose-key-type": "job-id", "loose-value-type": "job" } }, "job-id": { string: { "require-non-empty": true }, description: "A unique identifier for the job. The identifier must start with a letter or _ and contain only alphanumeric characters, -, or _." }, job: { description: "Each job must have an id to associate with the job. The key `job_id` is a string and its value is a map of the job's configuration data. You must replace `<job_id>` with a string that is unique to the jobs object. The `<job_id>` must start with a letter or _ and contain only alphanumeric characters, -, or _.", "one-of": ["job-factory", "workflow-job"] }, "job-factory": { mapping: { properties: { needs: "needs", if: "job-if", strategy: "strategy", name: { type: "string-strategy-context", description: "The name of the job displayed on GitHub." }, "runs-on": { type: "runs-on", required: true }, "timeout-minutes": { type: "number-strategy-context", description: "The maximum number of minutes to let a workflow run before GitHub automatically cancels it. Default: 360" }, "cancel-timeout-minutes": "number-strategy-context", "continue-on-error": { type: "boolean-strategy-context", description: "Prevents a workflow run from failing when a job fails. Set to true to allow a workflow run to pass when this job fails." }, container: "container", services: "services", env: "job-env", environment: "job-environment", permissions: "permissions", concurrency: "job-concurrency", outputs: "job-outputs", defaults: "job-defaults", steps: "steps", snapshot: "snapshot" } } }, "workflow-job": { mapping: { properties: { name: { type: "string-strategy-context", description: "The name of the job displayed on GitHub." }, uses: { description: "The location and version of a reusable workflow file to run as a job. Use one of the following formats:\n\n* `{owner}/{repo}/.github/workflows/{filename}@{ref}` for reusable workflows in public and private repositories.\n* `./.github/workflows/{filename}` for reusable workflows in the same repository.\n\n{ref} can be a SHA, a release tag, or a branch name. Using the commit SHA is the safest for stability and security.", type: "non-empty-string", required: true }, with: "workflow-job-with", secrets: "workflow-job-secrets", needs: "needs", if: "job-if", permissions: "permissions", concurrency: "job-concurrency", strategy: "strategy" } } }, "workflow-job-with": { description: "When a job is used to call a reusable workflow, you can use `with` to provide a map of inputs that are passed to the called workflow.\n\nAny inputs that you pass must match the input specifications defined in the called workflow.", mapping: { "loose-key-type": "non-empty-string", "loose-value-type": "scalar-needs-context" } }, "workflow-job-secrets": { description: "When a job is used to call a reusable workflow, you can use `secrets` to provide a map of secrets that are passed to the called workflow.\n\nAny secrets that you pass must match the names defined in the called workflow.", "one-of": ["workflow-job-secrets-mapping", "workflow-job-secrets-inherit"] }, "workflow-job-secrets-mapping": { mapping: { "loose-key-type": "non-empty-string", "loose-value-type": "scalar-needs-context-with-secrets" } }, "workflow-job-secrets-inherit": { string: { constant: "inherit" } }, needs: { description: "Use `needs` to identify any jobs that must complete successfully before this job will run. It can be a string or array of strings. If a job fails, all jobs that need it are skipped unless the jobs use a conditional expression that causes the job to continue. If a run contains a series of jobs that need each other, a failure applies to all jobs in the dependency chain from the point of failure onwards.", "one-of": ["sequence-of-non-empty-string", "non-empty-string"] }, "job-if": { description: "You can use the `if` conditional to prevent a job from running unless a condition is met. You can use any supported context and expression to create a conditional.", context: ["github", "inputs", "vars", "needs", "always(0,0)", "failure(0,MAX)", "cancelled(0,0)", "success(0,MAX)"], string: {} }, "job-if-result": { context: ["github", "inputs", "vars", "needs", "always(0,0)", "failure(0,MAX)", "cancelled(0,0)", "success(0,MAX)"], "one-of": ["null", "boolean", "number", "string", "sequence", "mapping"] }, strategy: { description: "Use `strategy` to use a matrix strategy for your jobs. A matrix strategy lets you use variables in a single job definition to automatically create multiple job runs that are based on the combinations of the variables. ", context: ["github", "inputs", "vars", "needs"], mapping: { properties: { "fail-fast": { type: "boolean", description: "Setting `fail-fast` to `false` prevents GitHub from canceling all in-progress jobs if any matrix job fails. Default: `true`" }, "max-parallel": { type: "number", description: "The maximum number of jobs that can run simultaneously when using a matrix job strategy. By default, GitHub will maximize the number of jobs run in parallel depending on runner availability." }, matrix: "matrix" } } }, matrix: { description: "Use `matrix` to define a matrix of different job configurations. Within your matrix, define one or more variables followed by an array of values.", mapping: { properties: { include: { type: "matrix-filter", description: "Use `include` to expand existing matrix configurations or to add new configurations. The value of `include` is a list of objects.\n\nFor each object in the `include` list, the key:value pairs in the object will be added to each of the matrix combinations if none of the key:value pairs overwrite any of the original matrix values. If the object cannot be added to any of the matrix combinations, a new matrix combination will be created instead. Note that the original matrix values will not be overwritten, but added matrix values can be overwritten." }, exclude: { type: "matrix-filter", description: "To remove specific configurations defined in the matrix, use `exclude`. An excluded configuration only has to be a partial match for it to be excluded." } }, "loose-key-type": "non-empty-string", "loose-value-type": "sequence" } }, "matrix-filter": { sequence: { "item-type": "matrix-filter-item" } }, "matrix-filter-item": { mapping: { "loose-key-type": "non-empty-string", "loose-value-type": "any" } }, snapshot: { description: "Use `snapshot` to define a custom image you want to create or update after your job succeeds by taking a snapshot of your runner.", "one-of": ["non-empty-string", "snapshot-mapping"] }, "snapshot-mapping": { mapping: { properties: { "image-name": { description: "The desired name of the custom image you want to create or update.", type: "non-empty-string", required: true }, if: "snapshot-if", version: { description: "The desired major version updates upon a new custom image version creation.", type: "non-empty-string" } } } }, "snapshot-if": { context: ["github", "inputs", "vars", "needs", "strategy", "matrix"], description: "Use the if conditional to prevent a snapshot from being taken unless a condition is met. Any supported context and expression can be used to create a conditional. Expressions in an `if` conditional do not require the bracketed expression syntax. When you use expressions in an `if` conditional, you may omit the expression syntax because GitHub automatically evaluates the `if` conditional as an expression.", string: {} }, "runs-on": { description: "Use `runs-on` to define the type of machine to run the job on.\n* The destination machine can be either a GitHub-hosted runner, larger runner, or a self-hosted runner.\n* You can target runners based on the labels assigned to them, or their group membership, or a combination of these.\n* You can provide `runs-on` as a single string or as an array of strings.\n* If you specify an array of strings, your workflow will execute on any runner that matches all of the specified `runs-on` values.\n* If you would like to run your workflow on multiple machines, use `jobs.<job_id>.strategy`.", context: ["github", "inputs", "vars", "needs", "strategy", "matrix"], "one-of": ["non-empty-string", "sequence-of-non-empty-string", "runs-on-mapping"] }, "runs-on-mapping": { mapping: { properties: { group: { description: "The group from which to select a runner.", type: "non-empty-string" }, labels: "runs-on-labels" } } }, "runs-on-labels": { description: "The label by which to filter for available runners.", "one-of": ["non-empty-string", "sequence-of-non-empty-string"] }, "job-env": { description: "A map of variables that are available to all steps in the job.", context: ["github", "inputs", "vars", "needs", "strategy", "matrix", "secrets"], mapping: { "loose-key-type": "non-empty-string", "loose-value-type": "string" } }, "workflow-concurrency": { description: "Concurrency ensures that only a single job or workflow using the same concurrency group will run at a time. A concurrency group can be any string or expression.\n\nYou can also specify `concurrency` at the job level.\n\n[Documentation](https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions#concurrency)", context: ["github", "inputs", "vars"], "one-of": ["string", "concurrency-mapping"] }, "job-concurrency": { description: "Concurrency ensures that only a single job using the same concurrency group will run at a time. A concurrency group can be any string or expression. The expression can use any context except for the `secrets` context.\n\nYou can also specify `concurrency` at the workflow level.", context: ["github", "inputs", "vars", "needs", "strategy", "matrix"], "one-of": ["non-empty-string", "concurrency-mapping"] }, "concurrency-mapping": { description: "Concurrency ensures that only a single job or workflow using the same concurrency group will run at a time. A concurrency group can be any string or expression.\n\nYou can also specify `concurrency` at the job level.\n\n[Documentation](https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions#concurrency)", mapping: { properties: { group: { type: "non-empty-string", required: true, description: "When a concurrent job or workflow is queued, if another job or workflow using the same concurrency group in the repository is in progress, the queued job or workflow will be `pending`. Any previously pending job or workflow in the concurrency group will be canceled. To also cancel any currently running job or workflow in the same concurrency group, specify `cancel-in-progress: true`." }, "cancel-in-progress": { type: "boolean", description: "To cancel any currently running job or workflow in the same concurrency group, specify cancel-in-progress: true." }, queue: { type: "concurrency-queue", description: "The queuing mode for the concurrency group. When set to `max`, workflows or jobs will wait in a queue for the concurrency group up to the maximum queue length. Default: `single` meaning at most one item can be pending." } } } }, "concurrency-queue": { "allowed-values": ["single", "max"] }, "job-environment": { description: "The environment that the job references. All environment protection rules must pass before a job referencing the environment is sent to a runner.", context: ["github", "inputs", "vars", "needs", "strategy", "matrix"], "one-of": ["string", "job-environment-mapping"] }, "job-environment-mapping": { mapping: { properties: { name: { type: "job-environment-name", required: true }, url: { type: "string-runner-context-no-secrets", description: "The environment URL, which maps to `environment_url` in the deployments API." }, deployment: { type: "boolean", description: "Whether to create a deployment record for this environment. Defaults to true." } } } }, "job-environment-name": { description: "The name of the environment used by the job.", context: ["github", "inputs", "vars", "needs", "strategy", "matrix"], string: {} }, "job-defaults": { description: "A map of default settings that will apply to all steps in the job. You can also set default settings for the entire workflow.", mapping: { properties: { run: "job-defaults-run" } } }, "job-defaults-run": { context: ["github", "inputs", "vars", "strategy", "matrix", "needs", "env"], mapping: { properties: { shell: "shell", "working-directory": "working-directory" } } }, "job-outputs": { description: "A map of outputs for a called workflow. Called workflow outputs are available to all downstream jobs in the caller workflow. Each output has an identifier, an optional `description,` and a `value`. The `value` must be set to the value of an output from a job within the called workflow.", mapping: { "loose-key-type": "non-empty-string", "loose-value-type": "string-runner-context" } }, steps: { description: "A job contains a sequence of tasks called `steps`. Steps can run commands, run setup tasks, run an action in your repository, a public repository, or an action published in a Docker registry, wait for background steps to complete, or cancel a background step. Not all steps run actions, but all actions run as a step. Each step runs in its own process in the runner environment and has access to the workspace and filesystem. Because steps run in their own process, changes to environment variables are not preserved between steps. GitHub provides built-in steps to set up and complete a job.", sequence: { "item-type": "steps-item" } }, "steps-item": { "one-of": ["run-step", "regular-step", "wait-step", "wait-all-step", "cancel-step", "parallel-step"] }, "run-step": { mapping: { properties: { name: "step-name", id: "step-id", if: "step-if", "timeout-minutes": "step-timeout-minutes", run: { type: "string-steps-context", description: "Runs command-line programs using the operating system's shell. If you do not provide a `name`, the step name will default to the text specified in the `run` command. Commands run using non-login shells by default. You can choose a different shell and customize the shell used to run commands. Each `run` keyword represents a new process and shell in the virtual environment. When you provide multi-line commands, each line runs in the same shell.", required: true }, "continue-on-error": "step-continue-on-error", env: "step-env", "working-directory": "string-steps-context", shell: "shell", background: "step-background" } } }, "regular-step": { mapping: { properties: { name: "step-name", id: "step-id", if: "step-if", "continue-on-error": "step-continue-on-error", "timeout-minutes": "step-timeout-minutes", uses: { type: "step-uses", required: true }, with: "step-with", env: "step-env", background: "step-background" } } }, "wait-step": { mapping: { properties: { name: "step-name", id: "step-id", "continue-on-error": "step-continue-on-error", wait: { type: "step-wait-target", required: true } } } }, "wait-all-step": { mapping: { properties: { name: "step-name", id: "step-id", "continue-on-error": "step-continue-on-error", "wait-all": { type: "step-wait-all-value", required: true } } } }, "cancel-step": { mapping: { properties: { name: "step-name", id: "step-id", "continue-on-error": "step-continue-on-error", cancel: { type: "step-cancel-target", required: true } } } }, "parallel-step": { mapping: { properties: { parallel: { type: "parallel-steps", required: true, description: "Run a group of steps concurrently. All steps in the parallel block run as background steps and the workflow waits for all of them to complete before continuing." } } } }, "parallel-steps": { sequence: { "item-type": "steps-item" } }, "step-uses": { description: "Selects an action to run as part of a step in your job. An action is a reusable unit of code. You can use an action defined in the same repository as the workflow, a public repository, a [private repository with access enabled](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository#allowing-access-to-components-in-a-private-repository), or in a published Docker container image.", string: { "require-non-empty": true } }, "step-background": { boolean: {}, description: "When set to true, runs this step in the background. The workflow continues to the next step immediately without waiting for the background step to finish." }, "step-wait-target": { description: "The step ID or IDs of background steps to wait for.", "one-of": ["non-empty-string", "sequence-of-non-empty-string"] }, "step-wait-all-value": { description: "Wait for all prior background steps to complete. Use as a bare key (`wait-all:`) or with a boolean value.", "one-of": ["null", "boolean"] }, "step-cancel-target": { description: "The step ID of a background step to cancel.", string: { "require-non-empty": true } }, "step-continue-on-error": { context: ["github", "inputs", "vars", "needs", "strategy", "matrix", "secrets", "steps", "job", "runner", "env", "hashFiles(1,255)"], boolean: {}, description: "Prevents a job from failing when a step fails. Set to `true` to allow a job to pass when this step fails." }, "step-id": { string: { "require-non-empty": true }, description: "A unique identifier for the step. You can use the `id` to reference the step in contexts." }, "step-if": { context: ["github", "inputs", "vars", "needs", "strategy", "matrix", "steps", "job", "runner", "env", "always(0,0)", "failure(0,0)", "cancelled(0,0)", "success(0,0)", "hashFiles(1,255)"], description: "Use the `if` conditional to prevent a step from running unless a condition is met. Any supported context and expression can be used to create a conditional. Expressions in an `if` conditional do not require the bracketed expression syntax. When you use expressions in an `if` conditional, you may omit the expression syntax because GitHub automatically evaluates the `if` conditional as an expression.", string: {} }, "step-if-result": { context: ["github", "inputs", "vars", "strategy", "matrix", "steps", "job", "runner", "env", "always(0,0)", "failure(0,0)", "cancelled(0,0)", "success(0,0)", "hashFiles(1,255)"], "one-of": ["null", "boolean", "number", "string", "sequence", "mapping"] }, "step-env": { description: "Sets variables for steps to use in the runner environment. You can also set variables for the entire workflow or a job.", context: ["github", "inputs", "vars", "needs", "strategy", "matrix", "secrets", "steps", "job", "runner", "env", "hashFiles(1,255)"], mapping: { "loose-key-type": "non-empty-string", "loose-value-type": "string" } }, "step-name": { context: ["github", "inputs", "vars", "needs", "strategy", "matrix", "secrets", "steps", "job", "runner", "env", "hashFiles(1,255)"], string: {}, description: "A name for your step to display on GitHub." }, "step-timeout-minutes": { context: ["github", "inputs", "vars", "needs", "strategy", "matrix", "secrets", "steps", "job", "runner", "env", "hashFiles(1,255)"], number: {}, description: "The maximum number of minutes to run the step before killing the process." }, "step-with": { description: "A map of the input parameters defined by the action. Each input parameter is a key/value pair. Input parameters are set as variables. When you specify an input in a workflow file or use a default input value, GitHub creates a variable for the input with the name `INPUT_<VARIABLE_NAME>`. The variable created converts input names to uppercase letters and replaces spaces with `_`.", context: ["github", "inputs", "vars", "needs", "strategy", "matrix", "secrets", "steps", "job", "runner", "env", "hashFiles(1,255)"], mapping: { "loose-key-type": "non-empty-string", "loose-value-type": "string" } }, container: { description: "A container to run any steps in a job that don't already specify a container. If you have steps that use both script and container actions, the container actions will run as sibling containers on the same network with the same volume mounts.\n\nIf you do not set a container, all steps will run directly on the host specified by runs-on unless a step refers to an action configured to run in a container.", context: ["github", "inputs", "vars", "needs", "strategy", "matrix"], "one-of": ["string", "container-mapping"] }, "container-mapping": { mapping: { properties: { image: { type: "non-empty-string", description: "Use `jobs.<job_id>.container.image` to define the Docker image to use as the container to run the action. The value can be the Docker Hub image or a registry name." }, options: { type: "string", description: "Use `jobs.<job_id>.container.options` to configure additional Docker container resource options." }, env: "container-env", ports: { type: "sequence-of-non-empty-string", description: "Use `jobs.<job_id>.container.ports` to set an array of ports to expose on the container." }, volumes: { type: "sequence-of-non-empty-string", description: "Use `jobs.<job_id>.container.volumes` to set an array of volumes for the container to use. You can use volumes to share data between services or other steps in a job. You can specify named Docker volumes, anonymous Docker volumes, or bind mounts on the host." }, credentials: "container-registry-credentials" } } }, services: { description: "Additional containers to host services for a job in a workflow. These are useful for creating databases or cache services like redis. The runner on the virtual machine will automatically create a network and manage the life cycle of the service containers. When you use a service container for a job or your step uses container actions, you don't need to set port information to access the service. Docker automatically exposes all ports between containers on the same network. When both the job and the action run in a container, you can directly reference the container by its hostname. The hostname is automatically mapped to the service name. When a step does not use a container action, you must access the service using localhost and bind the ports.", context: ["github", "inputs", "vars", "needs", "strategy", "matrix"], mapping: { "loose-key-type": "non-empty-string", "loose-value-type": "services-container" } }, "services-container": { context: ["github", "inputs", "vars", "needs", "strategy", "matrix"], "one-of": ["non-empty-string", "service-container-mapping"] }, "container-registry-credentials": { description: "If the image's container registry requires authentication to pull the image, you can use `jobs.<job_id>.container.credentials` to set a map of the username and password. The credentials are the same values that you would provide to the `docker login` command.", context: ["github", "inputs", "vars", "secrets", "env"], mapping: { properties: { username: "non-empty-string", password: "non-empty-string" } } }, "container-env": { description: "Use `jobs.<job_id>.container.env` to set a map of variables in the container.", mapping: { "loose-key-type": "non-empty-string", "loose-value-type": "string-runner-context" } }, "non-empty-string": { string: { "require-non-empty": true } }, "sequence-of-non-empty-string": { sequence: { "item-type": "non-empty-string" } }, "sequence-of-string": { sequence: { "item-type": "string" } }, "boolean-needs-context": { context: ["github", "inputs", "vars", "needs"], boolean: {} }, "number-needs-context": { context: ["github", "inputs", "vars", "needs"], number: {} }, "string-needs-context": { context: ["github", "inputs", "vars", "needs"], string: {} }, "scalar-needs-context": { context: ["github", "inputs", "vars", "needs", "strategy", "matrix"], "one-of": ["string", "boolean", "number"] }, "scalar-needs-context-with-secrets": { context: ["github", "inputs", "vars", "needs", "secrets", "strategy", "matrix"], "one-of": ["string", "boolean", "number"] }, "boolean-strategy-context": { context: ["github", "inputs", "vars", "needs", "strategy", "matrix"], boolean: {} }, "number-strategy-context": { context: ["github", "inputs", "vars", "needs", "strategy", "matrix"], number: {} }, "string-strategy-context": { context: ["github", "inputs", "vars", "needs", "strategy", "matrix"], string: {} }, "boolean-steps-context": { context: ["github", "inputs", "vars", "needs", "strategy", "matrix", "secrets", "steps", "job", "runner", "env", "hashFiles(1,255)"], boolean: {} }, "number-steps-context": { context: ["github", "inputs", "vars", "needs", "strategy", "matrix", "secrets", "steps", "job", "runner", "env", "hashFiles(1,255)"], number: {} }, "string-runner-context": { context: ["github", "inputs", "vars", "needs", "strategy", "matrix", "secrets", "steps", "job", "runner", "env"], string: {} }, "string-runner-context-no-secrets": { context: ["github", "inputs", "vars", "needs", "strategy", "matrix", "steps", "job", "runner", "env"], string: {} }, "string-steps-context": { context: ["github", "inputs", "vars", "needs", "strategy", "matrix", "secrets", "steps", "job", "runner", "env", "hashFiles(1,255)"], string: {} }, shell: { string: { "require-non-empty": true }, description: "Use `shell` to override the default shell settings in the runner's operating system. You can use built-in shell keywords, or you can define a custom set of shell options. The shell command that is run internally executes a temporary file that contains the commands specified in `run`." }, "working-directory": { string: { "require-non-empty": true }, description: "The `working-directory` keyword specifies the working directory where the command is run." }, "cron-mapping": { mapping: { properties: { cron: { type: "cron-pattern", required: true }, timezone: "timezone-string" } } }, "cron-pattern": { description: "A cron expression that represents a schedule. A scheduled workflow will run at most once every 5 minutes.", string: { "require-non-empty": true } }, "timezone-string": { description: "A string that represents the time zone a scheduled workflow will run relative to in IANA format (e.g. 'America/New_York' or 'Europe/London'). If omitted, the workflow will run relative to midnight UTC.", string: { "require-non-empty": true } }, "service-container-mapping": { mapping: { properties: { image: { type: "non-empty-string", description: "The Docker image to use as the container. The value can be the Docker Hub image or a registry name." }, options: { type: "string", description: "Additional Docker container resource options." }, env: "container-env", ports: { type: "sequence-of-non-empty-string", description: "An array of ports to expose on the container." }, volumes: { type: "sequence-of-non-empty-string", description: "An array of volumes for the container to use. You can use volumes to share data between services or other steps in a job. You can specify named Docker volumes, anonymous Docker volumes, or bind mounts on the host." }, credentials: "container-registry-credentials", entrypoint: { type: "string", description: "Override the default ENTRYPOINT in the service container image." }, command: { type: "string", description: "Override the default CMD in the service container image." } } } } } };

// node_modules/@actions/workflow-parser/dist/workflows/workflow-schema.js
var schema;
function getWorkflowSchema() {
  if (schema === void 0) {
    const json = JSON.stringify(workflow_v1_0_min_default);
    schema = TemplateSchema.load(new JSONObjectReader(void 0, json));
  }
  return schema;
}

// node_modules/@actions/workflow-parser/dist/workflows/yaml-object-reader.js
var import_yaml = __toESM(require_dist(), 1);
var YamlObjectReader = class _YamlObjectReader {
  constructor(fileId, content) {
    this.lineCounter = new import_yaml.LineCounter();
    this.errors = [];
    this.doc = (0, import_yaml.parseDocument)(content, {
      lineCounter: this.lineCounter,
      keepSourceTokens: true,
      uniqueKeys: false
      // Uniqueness is validated by the template reader
    });
    for (const err of this.doc.errors) {
      this.errors.push({ message: err.message, range: rangeFromLinePos(err.linePos) });
    }
    this._generator = this.getNodes(this.doc, /* @__PURE__ */ new Set());
    this.fileId = fileId;
  }
  *getNodes(node, aliasResolutionStack) {
    let range = this.getRange(node);
    if ((0, import_yaml.isDocument)(node)) {
      yield new ParseEvent(EventType.DocumentStart);
      for (const item of this.getNodes(node.contents, /* @__PURE__ */ new Set())) {
        yield item;
      }
      yield new ParseEvent(EventType.DocumentEnd);
    }
    if ((0, import_yaml.isCollection)(node)) {
      if ((0, import_yaml.isSeq)(node)) {
        yield new ParseEvent(EventType.SequenceStart, new SequenceToken(this.fileId, range, void 0));
      } else if ((0, import_yaml.isMap)(node)) {
        yield new ParseEvent(EventType.MappingStart, new MappingToken(this.fileId, range, void 0));
      }
      for (const item of node.items) {
        for (const child of this.getNodes(item, aliasResolutionStack)) {
          yield child;
        }
      }
      if ((0, import_yaml.isSeq)(node)) {
        yield new ParseEvent(EventType.SequenceEnd);
      } else if ((0, import_yaml.isMap)(node)) {
        yield new ParseEvent(EventType.MappingEnd);
      }
    }
    if ((0, import_yaml.isScalar)(node)) {
      yield new ParseEvent(EventType.Literal, _YamlObjectReader.getLiteralToken(this.fileId, range, node));
    }
    if ((0, import_yaml.isAlias)(node)) {
      const resolved = node.resolve(this.doc);
      if (resolved) {
        if (aliasResolutionStack.has(resolved)) {
          return;
        }
        const newStack = new Set(aliasResolutionStack);
        newStack.add(resolved);
        yield* this.getNodes(resolved, newStack);
      }
      return;
    }
    if ((0, import_yaml.isPair)(node)) {
      const scalarKey = node.key;
      range = this.getRange(scalarKey);
      const key = scalarKey.value;
      yield new ParseEvent(EventType.Literal, new StringToken(this.fileId, range, key, void 0));
      for (const child of this.getNodes(node.value, aliasResolutionStack)) {
        yield child;
      }
    }
  }
  getRange(node) {
    const range = node?.range ?? [];
    const startPos = range[0];
    const endPos = range[1];
    if (startPos !== void 0 && endPos !== void 0) {
      const slp = this.lineCounter.linePos(startPos);
      const elp = this.lineCounter.linePos(endPos);
      return {
        start: { line: slp.line, column: slp.col },
        end: { line: elp.line, column: elp.col }
      };
    }
    return void 0;
  }
  static getLiteralToken(fileId, range, token) {
    const value = token.value;
    if (value === null || value === void 0) {
      return new NullToken(fileId, range, void 0);
    }
    switch (typeof value) {
      case "number":
        return new NumberToken(fileId, range, value, void 0);
      case "boolean":
        return new BooleanToken(fileId, range, value, void 0);
      case "string": {
        let source;
        let blockScalarHeader;
        if (token.srcToken && "source" in token.srcToken) {
          source = token.srcToken.source;
          if (token.srcToken.type === "block-scalar" && "props" in token.srcToken) {
            const props = token.srcToken.props;
            const headerProp = props.find((p) => p.type === "block-scalar-header");
            if (headerProp?.source) {
              blockScalarHeader = headerProp.source;
            }
          }
        }
        return new StringToken(fileId, range, value, void 0, source, blockScalarHeader);
      }
      default:
        throw new Error(`Unexpected value type '${typeof value}' when reading object`);
    }
  }
  allowLiteral() {
    if (!this._current.done) {
      const parseEvent = this._current.value;
      if (parseEvent.type === EventType.Literal) {
        this._current = this._generator.next();
        return parseEvent.token;
      }
    }
    return void 0;
  }
  allowSequenceStart() {
    if (!this._current.done) {
      const parseEvent = this._current.value;
      if (parseEvent.type === EventType.SequenceStart) {
        this._current = this._generator.next();
        return parseEvent.token;
      }
    }
    return void 0;
  }
  allowSequenceEnd() {
    if (!this._current.done) {
      const parseEvent = this._current.value;
      if (parseEvent.type === EventType.SequenceEnd) {
        this._current = this._generator.next();
        return true;
      }
    }
    return false;
  }
  allowMappingStart() {
    if (!this._current.done) {
      const parseEvent = this._current.value;
      if (parseEvent.type === EventType.MappingStart) {
        this._current = this._generator.next();
        return parseEvent.token;
      }
    }
    return void 0;
  }
  allowMappingEnd() {
    if (!this._current.done) {
      const parseEvent = this._current.value;
      if (parseEvent.type === EventType.MappingEnd) {
        this._current = this._generator.next();
        return true;
      }
    }
    return false;
  }
  validateEnd() {
    if (!this._current.done) {
      const parseEvent = this._current.value;
      if (parseEvent.type === EventType.DocumentEnd) {
        this._current = this._generator.next();
        return;
      }
    }
    throw new Error("Expected end of reader");
  }
  validateStart() {
    if (!this._current) {
      this._current = this._generator.next();
    }
    if (!this._current.done) {
      const parseEvent = this._current.value;
      if (parseEvent.type === EventType.DocumentStart) {
        this._current = this._generator.next();
        return;
      }
    }
    throw new Error("Expected start of reader");
  }
};
function rangeFromLinePos(linePos) {
  if (linePos === void 0) {
    return;
  }
  const start = { line: linePos[0].line, column: linePos[0].col };
  const end = linePos.length == 2 ? { line: linePos[1].line, column: linePos[1].col } : start;
  return { start, end };
}

// node_modules/@actions/workflow-parser/dist/workflows/workflow-parser.js
function parseWorkflow(entryFile, contextOrTrace) {
  const context = contextOrTrace instanceof TemplateContext ? contextOrTrace : new TemplateContext(new TemplateValidationErrors(), getWorkflowSchema(), contextOrTrace);
  const fileId = context.getFileId(entryFile.name);
  const reader = new YamlObjectReader(fileId, entryFile.content);
  if (reader.errors.length > 0) {
    for (const err of reader.errors) {
      context.error(fileId, err.message, err.range);
    }
    return {
      context,
      value: void 0
    };
  }
  const result = readTemplate(context, WORKFLOW_ROOT, reader, fileId);
  return {
    context,
    value: result
  };
}

// node_modules/@actions/workflow-parser/dist/model/converter/concurrency.js
function convertConcurrency(context, token) {
  const result = {};
  if (token.isExpression) {
    return result;
  }
  if (isString(token)) {
    result.group = token;
    return result;
  }
  const concurrencyProperty = token.assertMapping("concurrency group");
  for (const property of concurrencyProperty) {
    const propertyName = property.key.assertString("concurrency group key");
    if (property.key.isExpression || property.value.isExpression) {
      continue;
    }
    switch (propertyName.value) {
      case "group":
        result.group = property.value.assertString("concurrency group");
        break;
      case "cancel-in-progress":
        result.cancelInProgress = property.value.assertBoolean("cancel-in-progress").value;
        break;
      case "queue":
        result.queue = property.value.assertString("queue").value;
        break;
      default:
        context.error(propertyName, `Invalid property name: ${propertyName.value}`);
    }
  }
  return result;
}

// node_modules/@actions/workflow-parser/dist/model/converter/cron.js
var import_cronstrue = __toESM(require_cronstrue(), 1);

// node_modules/@actions/workflow-parser/dist/model/converter/cron-constants.js
var MONTHS = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12
};
var DAYS = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6
};
var MINUTE_RANGE = { min: 0, max: 59 };
var HOUR_RANGE = { min: 0, max: 23 };
var DOM_RANGE = { min: 1, max: 31 };
var MONTH_RANGE = { min: 1, max: 12, names: MONTHS };
var DOW_RANGE = { min: 0, max: 6, names: DAYS };

// node_modules/@actions/workflow-parser/dist/model/converter/cron.js
function isValidCron(cron) {
  const parts = cron.split(/ +/);
  if (parts.length != 5) {
    return false;
  }
  const [minutes, hours, dom, months, dow] = parts;
  return validateCronPart(minutes, MINUTE_RANGE) && validateCronPart(hours, HOUR_RANGE) && validateCronPart(dom, DOM_RANGE) && validateCronPart(months, MONTH_RANGE) && validateCronPart(dow, DOW_RANGE);
}
function validateCronPart(value, range, allowSeparators = true) {
  if (range.names && range.names[value.toLowerCase()] !== void 0) {
    return true;
  }
  if (value === "*") {
    return true;
  }
  if (value.includes(",")) {
    if (!allowSeparators) {
      return false;
    }
    return value.split(",").every((v) => v && validateCronPart(v, range));
  }
  if (value.includes("/")) {
    if (!allowSeparators) {
      return false;
    }
    const [start, step, ...rest] = value.split("/");
    const stepNumber = +step;
    if (rest.length > 0 || isNaN(stepNumber) || stepNumber <= 0 || !start || !step) {
      return false;
    }
    return validateCronPart(start, range) && validateCronPart(step, range, false);
  }
  if (value.includes("-")) {
    if (!allowSeparators) {
      return false;
    }
    const [start, end, ...rest] = value.split("-");
    if (rest.length > 0 || !start || !end) {
      return false;
    }
    const startNumber = convertToNumber(start, range.names);
    const endNumber = convertToNumber(end, range.names);
    return validateCronPart(start, range, false) && validateCronPart(end, range, false) && endNumber >= startNumber;
  }
  const number = +value;
  return !isNaN(number) && number >= range.min && number <= range.max;
}
function convertToNumber(value, names) {
  if (names && names[value.toLowerCase()] !== void 0) {
    return +names[value.toLowerCase()];
  } else {
    return +value;
  }
}

// node_modules/@actions/workflow-parser/dist/model/converter/string-list.js
function convertStringList(name2, token) {
  const result = [];
  for (const item of token) {
    result.push(item.assertString(`${name2} item`).value);
  }
  return result;
}

// node_modules/@actions/workflow-parser/dist/model/workflow-template.js
var InputType;
(function(InputType2) {
  InputType2["string"] = "string";
  InputType2["choice"] = "choice";
  InputType2["boolean"] = "boolean";
  InputType2["environment"] = "environment";
})(InputType || (InputType = {}));

// node_modules/@actions/workflow-parser/dist/model/converter/workflow-call.js
function convertEventWorkflowCall(context, token) {
  const result = {};
  for (const item of token) {
    const key = item.key.assertString("workflow dispatch input key");
    switch (key.value) {
      case "inputs":
        result.inputs = convertWorkflowInputs(context, item.value.assertMapping("workflow dispatch inputs"));
        break;
      case "secrets":
        result.secrets = convertWorkflowCallSecrets(context, item.value.assertMapping("workflow dispatch inputs"));
        break;
      case "outputs":
        break;
    }
  }
  return result;
}
function convertWorkflowInputs(context, token) {
  const result = {};
  for (const item of token) {
    const inputName = item.key.assertString("input name");
    const inputMapping = item.value.assertMapping("input configuration");
    result[inputName.value] = convertWorkflowInput(context, inputMapping);
  }
  return result;
}
function convertWorkflowInput(context, token) {
  const result = {
    type: InputType.string
    // Default to string
  };
  let defaultValue;
  for (const item of token) {
    const key = item.key.assertString("workflow dispatch input key");
    switch (key.value) {
      case "description":
        result.description = item.value.assertString("input description").value;
        break;
      case "required":
        result.required = item.value.assertBoolean("input required").value;
        break;
      case "default":
        defaultValue = item.value.assertScalar("input default");
        break;
      case "type":
        result.type = InputType[item.value.assertString("input type").value];
        break;
      case "options":
        result.options = convertStringList("input options", item.value.assertSequence("input options"));
        break;
      default:
        context.error(item.key, `Invalid key '${key.value}'`);
    }
  }
  if (defaultValue !== void 0 && !defaultValue.isExpression) {
    try {
      switch (result.type) {
        case InputType.boolean:
          result.default = defaultValue.assertBoolean("input default").value;
          break;
        case InputType.string:
        case InputType.choice:
        case InputType.environment:
          result.default = defaultValue.assertString("input default").value;
          break;
      }
    } catch (e) {
      context.error(defaultValue, e);
    }
  }
  if (result.type === InputType.choice) {
    if (result.options === void 0 || result.options.length === 0) {
      context.error(token, "Missing 'options' for choice input");
    }
  } else {
    if (result.options !== void 0) {
      context.error(token, "Input type is not 'choice', but 'options' is defined");
    }
  }
  return result;
}
function convertWorkflowCallSecrets(context, token) {
  const result = {};
  for (const item of token) {
    const secretName = item.key.assertString("secret name");
    result[secretName.value] = convertWorkflowCallSecret(context, item.value);
  }
  return result;
}
function convertWorkflowCallSecret(context, token) {
  const result = {};
  if (isMapping(token)) {
    for (const item of token) {
      const key = item.key.assertString("workflow call secret key");
      switch (key.value) {
        case "description":
          result.description = item.value.assertString("secret description").value;
          break;
        case "required":
          result.required = item.value.assertBoolean("secret required").value;
          break;
      }
    }
  }
  return result;
}

// node_modules/@actions/workflow-parser/dist/model/converter/workflow-dispatch.js
function convertEventWorkflowDispatchInputs(context, token) {
  const result = {};
  for (const item of token) {
    const key = item.key.assertString("workflow dispatch input key");
    switch (key.value) {
      case "inputs":
        result.inputs = convertWorkflowDispatchInputs(context, item.value.assertMapping("workflow dispatch inputs"));
        break;
    }
  }
  return result;
}
function convertWorkflowDispatchInputs(context, token) {
  const result = {};
  for (const item of token) {
    const inputName = item.key.assertString("input name");
    const inputMapping = item.value.assertMapping("input configuration");
    result[inputName.value] = convertWorkflowDispatchInput(context, inputMapping);
  }
  return result;
}
function convertWorkflowDispatchInput(context, token) {
  const result = {
    type: InputType.string
    // Default to string
  };
  let defaultValue;
  for (const item of token) {
    const key = item.key.assertString("workflow dispatch input key");
    switch (key.value) {
      case "description":
        result.description = item.value.assertString("input description").value;
        break;
      case "required":
        result.required = item.value.assertBoolean("input required").value;
        break;
      case "default":
        defaultValue = item.value.assertScalar("input default");
        break;
      case "type":
        result.type = InputType[item.value.assertString("input type").value];
        break;
      case "options":
        result.options = convertStringList("input options", item.value.assertSequence("input options"));
        break;
      default:
        context.error(item.key, `Invalid key '${key.value}'`);
    }
  }
  if (defaultValue !== void 0) {
    try {
      switch (result.type) {
        case InputType.boolean:
          result.default = defaultValue.assertBoolean("input default").value;
          break;
        case InputType.string:
        case InputType.choice:
        case InputType.environment:
          result.default = defaultValue.assertString("input default").value;
          break;
      }
    } catch (e) {
      context.error(defaultValue, e);
    }
  }
  if (result.type === InputType.choice) {
    if (result.options === void 0 || result.options.length === 0) {
      context.error(token, "Missing 'options' for choice input");
    }
  } else {
    if (result.options !== void 0) {
      context.error(token, "Input type is not 'choice', but 'options' is defined");
    }
  }
  return result;
}

// node_modules/@actions/workflow-parser/dist/model/converter/events.js
function convertOn(context, token) {
  if (isLiteral(token)) {
    const event = token.assertString("on");
    return {
      [event.value]: {}
    };
  }
  if (isSequence(token)) {
    const result = {};
    for (const item of token) {
      const event = item.assertString("on");
      result[event.value] = {};
    }
    return result;
  }
  if (isMapping(token)) {
    const result = {};
    for (const item of token) {
      const eventKey = item.key.assertString("event name");
      const eventName = eventKey.value;
      if (item.value.templateTokenType === TokenType2.Null) {
        result[eventName] = {};
        continue;
      }
      if (eventName === "schedule") {
        const scheduleToken = item.value.assertSequence(`event ${eventName}`);
        result.schedule = convertSchedule(context, scheduleToken);
        continue;
      }
      const eventToken = item.value.assertMapping(`event ${eventName}`);
      if (eventName === "workflow_call") {
        result.workflow_call = convertEventWorkflowCall(context, eventToken);
        continue;
      }
      if (eventName === "workflow_dispatch") {
        result.workflow_dispatch = convertEventWorkflowDispatchInputs(context, eventToken);
        continue;
      }
      result[eventName] = {
        ...convertPatternFilter("branches", eventToken),
        ...convertPatternFilter("tags", eventToken),
        ...convertPatternFilter("paths", eventToken),
        ...convertFilter("types", eventToken),
        ...convertFilter("versions", eventToken),
        ...convertFilter("names", eventToken),
        ...convertFilter("workflows", eventToken)
      };
    }
    return result;
  }
  context.error(token, "Invalid format for 'on'");
  return {};
}
function convertPatternFilter(name2, token) {
  const result = {};
  for (const item of token) {
    const key = item.key.assertString(`${name2} filter key`);
    switch (key.value) {
      case name2:
        if (isString(item.value)) {
          result[name2] = [item.value.value];
        } else {
          result[name2] = convertStringList(name2, item.value.assertSequence(`${name2} list`));
        }
        break;
      case `${name2}-ignore`:
        if (isString(item.value)) {
          result[`${name2}-ignore`] = [item.value.value];
        } else {
          result[`${name2}-ignore`] = convertStringList(`${name2}-ignore`, item.value.assertSequence(`${name2}-ignore list`));
        }
        break;
    }
  }
  return result;
}
function convertFilter(name2, token) {
  const result = {};
  for (const item of token) {
    const key = item.key.assertString(`${name2} filter key`);
    switch (key.value) {
      case name2:
        if (isString(item.value)) {
          result[name2] = [item.value.value];
        } else {
          result[name2] = convertStringList(name2, item.value.assertSequence(`${name2} list`));
        }
        break;
    }
  }
  return result;
}
function convertSchedule(context, token) {
  const result = [];
  for (const item of token) {
    const mappingToken = item.assertMapping(`event schedule`);
    const config = { cron: "" };
    let valid = true;
    for (const entry of mappingToken) {
      const key = entry.key.assertString(`schedule key`);
      if (key.value === "cron") {
        const cron = entry.value.assertString(`schedule cron`);
        if (!isValidCron(cron.value)) {
          context.error(cron, "Invalid cron expression. Expected format: '* * * * *' (minute hour day month weekday)");
        }
        config.cron = cron.value;
      } else if (key.value === "timezone") {
        const timezone = entry.value.assertString(`schedule timezone`);
        config.timezone = timezone.value;
      } else {
        context.error(key, `Invalid schedule key`);
        valid = false;
      }
    }
    if (valid && config.cron) {
      result.push(config);
    } else if (valid && !config.cron) {
      context.error(mappingToken, "Missing required key 'cron' in schedule entry");
    }
  }
  return result;
}

// node_modules/@actions/workflow-parser/dist/model/converter/handle-errors.js
function handleTemplateTokenErrors(root, context, defaultValue, f) {
  let r = defaultValue;
  try {
    r = f();
  } catch (err) {
    if (err instanceof TemplateTokenError) {
      context.error(err.token, err);
    } else {
      context.error(root, err);
    }
  }
  return r;
}

// node_modules/@actions/workflow-parser/dist/model/converter/if-condition.js
function ensureStatusFunction(condition, definitionInfo) {
  const allowedContext = definitionInfo?.allowedContext || [];
  try {
    const { namedContexts, functions } = splitAllowedContext(allowedContext);
    const lexer = new Lexer(condition);
    const result = lexer.lex();
    const parser = new Parser(result.tokens, namedContexts, functions);
    const tree = parser.parse();
    if (walkTreeToFindStatusFunctionCalls(tree)) {
      return condition;
    }
    return `success() && (${condition})`;
  } catch {
    return condition;
  }
}
function convertToIfCondition(context, token) {
  const scalar = token.assertScalar("if condition");
  const allowedContext = token.definitionInfo?.allowedContext || [];
  let condition;
  let source;
  if (scalar instanceof BasicExpressionToken) {
    condition = scalar.expression;
    source = scalar.source;
  } else {
    const stringToken = scalar.assertString("if condition");
    condition = stringToken.value.trim();
    source = stringToken.source;
  }
  let finalCondition;
  if (!condition) {
    finalCondition = "success()";
  } else {
    finalCondition = ensureStatusFunction(condition, token.definitionInfo);
  }
  try {
    ExpressionToken.validateExpression(finalCondition, allowedContext);
  } catch (err) {
    context.error(token, err);
    return void 0;
  }
  return new BasicExpressionToken(token.file, token.range, finalCondition, token.definitionInfo, void 0, source);
}
function walkTreeToFindStatusFunctionCalls(tree) {
  if (!tree) {
    return false;
  }
  if (tree instanceof FunctionCall) {
    const funcName = tree.functionName.lexeme.toLowerCase();
    if (funcName === "success" || funcName === "failure" || funcName === "cancelled" || funcName === "always") {
      return true;
    }
    return tree.args.some((arg) => walkTreeToFindStatusFunctionCalls(arg));
  }
  if (tree instanceof Binary) {
    return walkTreeToFindStatusFunctionCalls(tree.left) || walkTreeToFindStatusFunctionCalls(tree.right);
  }
  if (tree instanceof Unary) {
    return walkTreeToFindStatusFunctionCalls(tree.expr);
  }
  if (tree instanceof Logical) {
    return tree.args.some((arg) => walkTreeToFindStatusFunctionCalls(arg));
  }
  if (tree instanceof Grouping) {
    return walkTreeToFindStatusFunctionCalls(tree.group);
  }
  if (tree instanceof IndexAccess) {
    return walkTreeToFindStatusFunctionCalls(tree.expr) || walkTreeToFindStatusFunctionCalls(tree.index);
  }
  return false;
}

// node_modules/@actions/workflow-parser/dist/model/converter/container.js
function convertToJobContainer(context, container) {
  let image;
  let env;
  let ports;
  let volumes;
  let options;
  for (const [, token] of TemplateToken.traverse(container)) {
    if (token.isExpression) {
      return;
    }
  }
  if (isString(container)) {
    image = container.assertString("container item");
    return { image };
  }
  const mapping = container.assertMapping("container item");
  if (mapping)
    for (const item of mapping) {
      const key = item.key.assertString("container item key");
      const value = item.value;
      switch (key.value) {
        case "image":
          image = value.assertString("container image");
          break;
        case "credentials":
          convertToJobCredentials(context, value);
          break;
        case "env":
          env = value.assertMapping("container env");
          for (const envItem of env) {
            envItem.key.assertString("container env value");
          }
          break;
        case "ports":
          ports = value.assertSequence("container ports");
          for (const port of ports) {
            port.assertString("container port");
          }
          break;
        case "volumes":
          volumes = value.assertSequence("container volumes");
          for (const volume of volumes) {
            volume.assertString("container volume");
          }
          break;
        case "options":
          options = value.assertString("container options");
          break;
        default:
          context.error(key, `Unexpected container item key: ${key.value}`);
      }
    }
  if (!image) {
    context.error(container, "Container image cannot be empty");
  } else {
    return { image, env, ports, volumes, options };
  }
}
function convertToServiceContainer(context, container) {
  let image;
  let env;
  let ports;
  let volumes;
  let options;
  let entrypoint;
  let command;
  for (const [, token] of TemplateToken.traverse(container)) {
    if (token.isExpression) {
      return;
    }
  }
  if (isString(container)) {
    image = container.assertString("container item");
    return { image };
  }
  const mapping = container.assertMapping("container item");
  if (mapping)
    for (const item of mapping) {
      const key = item.key.assertString("container item key");
      const value = item.value;
      switch (key.value) {
        case "image":
          image = value.assertString("container image");
          break;
        case "credentials":
          convertToJobCredentials(context, value);
          break;
        case "env":
          env = value.assertMapping("container env");
          for (const envItem of env) {
            envItem.key.assertString("container env value");
          }
          break;
        case "ports":
          ports = value.assertSequence("container ports");
          for (const port of ports) {
            port.assertString("container port");
          }
          break;
        case "volumes":
          volumes = value.assertSequence("container volumes");
          for (const volume of volumes) {
            volume.assertString("container volume");
          }
          break;
        case "options":
          options = value.assertString("container options");
          break;
        case "entrypoint":
          entrypoint = value.assertString("container entrypoint");
          break;
        case "command":
          command = value.assertString("container command");
          break;
        default:
          context.error(key, `Unexpected container item key: ${key.value}`);
      }
    }
  if (!image) {
    context.error(container, "Container image cannot be empty");
  } else {
    return { image, env, ports, volumes, options, entrypoint, command };
  }
}
function convertToJobServices(context, services) {
  const serviceList = [];
  const mapping = services.assertMapping("services");
  for (const service of mapping) {
    service.key.assertString("service key");
    const container = convertToServiceContainer(context, service.value);
    if (container) {
      serviceList.push(container);
    }
  }
  return serviceList;
}
function convertToJobCredentials(context, value) {
  const mapping = value.assertMapping("credentials");
  let username;
  let password;
  for (const item of mapping) {
    const key = item.key.assertString("credentials item");
    const value2 = item.value;
    switch (key.value) {
      case "username":
        username = value2.assertString("credentials username");
        break;
      case "password":
        password = value2.assertString("credentials password");
        break;
      default:
        context.error(key, `credentials key ${key.value}`);
    }
  }
  return { username, password };
}

// node_modules/@actions/workflow-parser/dist/model/converter/id-builder.js
var SEPARATOR = "_";
var MAX_ATTEMPTS = 1e3;
var MAX_LENGTH = 100;
var IdBuilder = class {
  constructor() {
    this.name = [];
    this.distinctNames = /* @__PURE__ */ new Set();
  }
  appendSegment(value) {
    if (value.length === 0) {
      return;
    }
    if (this.name.length == 0) {
      const first = value[0];
      if (this.isAlpha(first) || first == "_") {
      } else if (this.isNumeric(first) || first == "-") {
        this.name.push("_");
      } else {
      }
    } else {
      this.name.push(SEPARATOR);
    }
    for (const c of value) {
      {
        if (this.isAlphaNumeric(c) || c == "_" || c == "-") {
          this.name.push(c);
        } else {
          this.name.push(SEPARATOR);
        }
      }
    }
  }
  build() {
    const original = this.name.length > 0 ? this.name.join("") : "job";
    let suffix = "";
    for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt++) {
      if (attempt === 1) {
        suffix = "";
      } else {
        suffix = `_${attempt}`;
      }
      const candidate = original.substring(0, Math.min(original.length, MAX_LENGTH - suffix.length)) + suffix;
      if (!this.distinctNames.has(candidate)) {
        this.distinctNames.add(candidate);
        this.name = [];
        return candidate;
      }
    }
    throw new Error("Unable to create a unique name");
  }
  /**
   * Adds a known identifier to the set of distinct ids.
   * @param value The value to add
   * @returns An error if the value is invalid, otherwise undefined
   */
  tryAddKnownId(value) {
    if (!value || !this.isValid(value) || value.length >= MAX_LENGTH) {
      return `The identifier '${value}' is invalid. IDs may only contain alphanumeric characters, '_', and '-'. IDs must start with a letter or '_' and and must be less than ${MAX_LENGTH} characters.`;
    }
    if (value.startsWith(SEPARATOR + SEPARATOR)) {
      return `The identifier '${value}' is invalid. IDs starting with '__' are reserved.`;
    }
    if (this.distinctNames.has(value)) {
      return `The identifier '${value}' may not be used more than once within the same scope.`;
    }
    this.distinctNames.add(value);
    return;
  }
  /**
   * A name is valid if it starts with a letter or underscore, and contains only
   * letters, numbers, underscores, and hyphens.
   * @param name The string name to validate
   * @returns Whether the name is valid
   */
  isValid(name2) {
    let first = true;
    for (const c of name2) {
      if (first) {
        first = false;
        if (!this.isAlpha(c) && c != "_") {
          return false;
        }
        continue;
      }
      if (!this.isAlphaNumeric(c) && c != "_" && c != "-") {
        return false;
      }
    }
    return true;
  }
  isAlphaNumeric(c) {
    return this.isAlpha(c) || this.isNumeric(c);
  }
  isNumeric(c) {
    return c >= "0" && c <= "9";
  }
  isAlpha(c) {
    return c >= "a" && c <= "z" || c >= "A" && c <= "Z";
  }
};

// node_modules/@actions/workflow-parser/dist/model/converter/job/environment.js
function convertToActionsEnvironmentRef(context, token) {
  const result = {};
  if (token.isExpression) {
    return result;
  }
  if (isScalar(token)) {
    result.name = token;
    return result;
  }
  const environmentMapping = token.assertMapping("job environment");
  for (const property of environmentMapping) {
    const propertyName = property.key.assertString("job environment key");
    if (property.key.isExpression || property.value.isExpression) {
      continue;
    }
    switch (propertyName.value) {
      case "name":
        result.name = property.value.assertScalar("job environment name key");
        break;
      case "url":
        result.url = property.value;
        break;
      case "deployment": {
        const deploymentValue = property.value.assertBoolean("job environment deployment");
        if (deploymentValue.value === false) {
          result.skipDeployment = true;
        }
        break;
      }
    }
  }
  return result;
}

// node_modules/@actions/workflow-parser/dist/model/converter/job/runs-on.js
function convertRunsOn(context, token) {
  const labels = convertRunsOnLabels(token);
  if (!isMapping(token)) {
    return {
      labels,
      group: ""
    };
  }
  let group = "";
  for (const item of token) {
    const key = item.key.assertString("job runs-on property name");
    switch (key.value) {
      case "group": {
        if (item.value.isExpression) {
          continue;
        }
        const groupName = item.value.assertString("job runs-on group name").value;
        const names = groupName.split("/");
        switch (names.length) {
          case 1: {
            group = groupName;
            break;
          }
          case 2: {
            if (!["org", "organization", "ent", "enterprise"].includes(names[0])) {
              context.error(item.value, `Invalid runs-on group name '${groupName}. Please use 'organization/' or 'enterprise/' prefix to target a single runner group.'`);
              continue;
            }
            if (!names[1]) {
              context.error(item.value, `Invalid runs-on group name '${groupName}'.`);
              continue;
            }
            group = groupName;
            break;
          }
          default: {
            context.error(item.value, `Invalid runs-on group name '${groupName}. Please use 'organization/' or 'enterprise/' prefix to target a single runner group.'`);
            break;
          }
        }
        break;
      }
      case "labels": {
        const mapLabels = convertRunsOnLabels(item.value);
        for (const label of mapLabels) {
          labels.add(label);
        }
        break;
      }
    }
  }
  return {
    labels,
    group
  };
}
function convertRunsOnLabels(token) {
  const labels = /* @__PURE__ */ new Set();
  if (token.isExpression) {
    return labels;
  }
  if (isString(token)) {
    labels.add(token.value);
    return labels;
  }
  if (isSequence(token)) {
    for (const item of token) {
      if (item.isExpression) {
        continue;
      }
      const label = item.assertString("job runs-on label sequence item");
      labels.add(label.value);
    }
  }
  return labels;
}

// node_modules/@actions/workflow-parser/dist/model/type-guards.js
function isActionStep(step) {
  return step.uses !== void 0;
}

// node_modules/@actions/workflow-parser/dist/model/converter/steps.js
function convertSteps(context, steps) {
  if (!isSequence(steps)) {
    context.error(steps, "Invalid format for steps");
    return [];
  }
  const idBuilder = new IdBuilder();
  const knownStepIds = /* @__PURE__ */ new Set();
  const result = [];
  for (const item of steps) {
    const step = handleTemplateTokenErrors(steps, context, void 0, () => convertStep(context, idBuilder, knownStepIds, item));
    if (step) {
      result.push(step);
    }
  }
  for (const step of result) {
    if (step.id) {
      continue;
    }
    let id = "";
    if (isActionStep(step)) {
      id = createActionStepId(step);
    } else if ("wait" in step) {
      id = "wait";
    } else if ("wait-all" in step) {
      id = "wait-all";
    } else if ("cancel" in step) {
      id = "cancel";
    } else if ("parallel" in step) {
      id = "parallel";
    }
    if (!id) {
      id = "run";
    }
    idBuilder.appendSegment(`__${id}`);
    step.id = idBuilder.build();
  }
  return result;
}
function convertStep(context, idBuilder, knownStepIds, step) {
  const mapping = step.assertMapping("steps item");
  let run;
  let id;
  let name2;
  let uses;
  let background;
  let wait;
  let waitAll;
  let cancel;
  let parallel;
  let continueOnError;
  let env;
  let ifCondition;
  for (const item of mapping) {
    const key = item.key.assertString("steps item key");
    switch (key.value) {
      case "id":
        id = item.value.assertString("steps item id");
        if (id) {
          const error = idBuilder.tryAddKnownId(id.value);
          if (error) {
            context.error(id, error);
          } else {
            knownStepIds.add(id.value);
          }
        }
        break;
      case "name":
        name2 = item.value.assertScalar("steps item name");
        break;
      case "run":
        run = item.value.assertScalar("steps item run");
        break;
      case "uses":
        uses = item.value.assertString("steps item uses");
        break;
      case "background":
        background = item.value.assertBoolean("steps item background").value;
        break;
      case "wait":
        wait = convertWaitTargets(context, knownStepIds, item.value, id);
        break;
      case "wait-all":
        waitAll = convertWaitAllValue(context, item.value);
        break;
      case "cancel":
        cancel = item.value.assertString("steps item cancel");
        validateTargetStepId(context, knownStepIds, cancel, id);
        break;
      case "parallel":
        parallel = item.value;
        break;
      case "env":
        env = item.value.assertMapping("step env");
        break;
      case "if":
        ifCondition = convertToIfCondition(context, item.value);
        break;
      case "continue-on-error":
        if (!item.value.isExpression) {
          continueOnError = item.value.assertBoolean("steps item continue-on-error").value;
        } else {
          continueOnError = item.value.assertScalar("steps item continue-on-error");
        }
    }
  }
  if (run) {
    return {
      id: id?.value || "",
      name: name2,
      if: ifCondition || new BasicExpressionToken(void 0, void 0, "success()", void 0, void 0, void 0),
      "continue-on-error": continueOnError,
      env,
      run,
      background
    };
  }
  if (uses) {
    return {
      id: id?.value || "",
      name: name2,
      if: ifCondition || new BasicExpressionToken(void 0, void 0, "success()", void 0, void 0, void 0),
      "continue-on-error": continueOnError,
      env,
      uses,
      background
    };
  }
  if (wait) {
    return {
      id: id?.value || "",
      name: name2 || createSyntheticStepName("Wait"),
      "continue-on-error": continueOnError,
      wait
    };
  }
  if (waitAll !== void 0) {
    return {
      id: id?.value || "",
      name: name2 || createSyntheticStepName("Wait for all"),
      "continue-on-error": continueOnError,
      "wait-all": waitAll
    };
  }
  if (cancel) {
    return {
      id: id?.value || "",
      name: name2 || createSyntheticStepName("Cancel"),
      "continue-on-error": continueOnError,
      cancel
    };
  }
  if (parallel) {
    const parallelSteps = convertSteps(context, parallel);
    for (const ps of parallelSteps) {
      if ("background" in ps && ps.background !== void 0) {
        context.error(step, "'background' is not allowed inside a parallel block. Steps in a parallel block are automatically run as background steps.");
      }
      if ("wait" in ps) {
        context.error(step, "'wait' is not allowed inside a parallel block.");
      }
      if ("wait-all" in ps) {
        context.error(step, "'wait-all' is not allowed inside a parallel block.");
      }
      if ("cancel" in ps) {
        context.error(step, "'cancel' is not allowed inside a parallel block.");
      }
      if ("parallel" in ps) {
        context.error(step, "Nested 'parallel' blocks are not allowed.");
      }
    }
    return {
      id: id?.value || "",
      name: name2 || createSyntheticStepName("Parallel group"),
      parallel: parallelSteps
    };
  }
  context.error(step, context.state.featureFlags?.isEnabled("allowBackgroundSteps") ? "Expected one of uses, run, wait, wait-all, cancel, or parallel to be defined" : "Expected one of uses or run to be defined");
}
function createActionStepId(step) {
  const uses = step.uses.value;
  if (uses.startsWith("docker://")) {
    return uses.substring("docker://".length);
  }
  if (uses.startsWith("./") || uses.startsWith(".\\")) {
    return "self";
  }
  if (uses.startsWith("$/")) {
    return "self";
  }
  const segments = uses.split("@");
  if (segments.length != 2) {
    return "";
  }
  const pathSegments = segments[0].split(/[\\/]/).filter((s) => s.length > 0);
  const gitRef = segments[1];
  if (pathSegments.length >= 2 && pathSegments[0] && pathSegments[1] && gitRef) {
    return `${pathSegments[0]}/${pathSegments[1]}`;
  }
  return "";
}
function createSyntheticStepName(value) {
  return new StringToken(void 0, void 0, value, void 0, void 0, void 0);
}
function convertWaitTargets(context, knownStepIds, token, ownStepId) {
  if (token instanceof StringToken) {
    validateTargetStepId(context, knownStepIds, token, ownStepId);
    return [token];
  }
  const sequence = token.assertSequence("steps item wait");
  const targets = [];
  for (let i = 0; i < sequence.count; i++) {
    const target = sequence.get(i).assertString("steps item wait item");
    validateTargetStepId(context, knownStepIds, target, ownStepId);
    targets.push(target);
  }
  return targets;
}
function convertWaitAllValue(context, token) {
  if (token instanceof NullToken) {
    return true;
  }
  const value = token.assertBoolean("steps item wait-all").value;
  if (!value) {
    context.error(token, "The value of 'wait-all' must be true or omitted");
  }
  return true;
}
function validateTargetStepId(context, knownStepIds, target, ownStepId) {
  if (target.value.startsWith("__")) {
    context.error(target, `The identifier '${target.value}' is invalid. IDs starting with '__' are reserved.`);
  } else if (ownStepId && target.value.toLowerCase() === ownStepId.value.toLowerCase()) {
    context.error(target, `Step '${ownStepId.value}' cannot reference itself`);
  } else if (!knownStepIds.has(target.value)) {
    context.error(target, `Step references unknown step ID '${target.value}'`);
  }
}

// node_modules/@actions/workflow-parser/dist/model/converter/job.js
function convertJob(context, jobKey, token) {
  const error = new IdBuilder().tryAddKnownId(jobKey.value);
  if (error) {
    context.error(jobKey, error);
  }
  let concurrency, container, env, environment, ifCondition, name2, outputs, runsOn, services, strategy, snapshot;
  let needs = void 0;
  let steps = [];
  let workflowJobRef;
  let workflowJobInputs;
  let inheritSecrets = false;
  let workflowJobSecrets;
  for (const item of token) {
    const propertyName = item.key.assertString("job property name");
    switch (propertyName.value) {
      case "concurrency":
        handleTemplateTokenErrors(item.value, context, void 0, () => convertConcurrency(context, item.value));
        concurrency = item.value;
        break;
      case "container":
        convertToJobContainer(context, item.value);
        container = item.value;
        break;
      case "env":
        handleTemplateTokenErrors(item.value, context, void 0, () => {
          env = item.value.assertMapping("job env");
        });
        break;
      case "environment":
        handleTemplateTokenErrors(item.value, context, void 0, () => convertToActionsEnvironmentRef(context, item.value));
        environment = item.value;
        break;
      case "if":
        ifCondition = convertToIfCondition(context, item.value);
        break;
      case "name":
        name2 = item.value.assertScalar("job name");
        break;
      case "needs": {
        needs = [];
        if (isString(item.value)) {
          const jobNeeds = item.value.assertString("job needs id");
          needs.push(jobNeeds);
        }
        if (isSequence(item.value)) {
          for (const seqItem of item.value) {
            const jobNeeds = seqItem.assertString("job needs id");
            needs.push(jobNeeds);
          }
        }
        break;
      }
      case "outputs":
        handleTemplateTokenErrors(item.value, context, void 0, () => {
          outputs = item.value.assertMapping("job outputs");
        });
        break;
      case "runs-on":
        handleTemplateTokenErrors(item.value, context, void 0, () => convertRunsOn(context, item.value));
        runsOn = item.value;
        break;
      case "services":
        convertToJobServices(context, item.value);
        services = item.value;
        break;
      case "snapshot":
        snapshot = item.value;
        break;
      case "steps":
        steps = convertSteps(context, item.value);
        break;
      case "strategy":
        strategy = item.value;
        break;
      case "uses":
        workflowJobRef = item.value.assertString("job uses value");
        break;
      case "with":
        handleTemplateTokenErrors(item.value, context, void 0, () => {
          workflowJobInputs = item.value.assertMapping("uses-with value");
        });
        break;
      case "secrets":
        if (isString(item.value) && item.value.value === "inherit") {
          inheritSecrets = true;
        } else {
          handleTemplateTokenErrors(item.value, context, void 0, () => {
            workflowJobSecrets = item.value.assertMapping("uses-secrets value");
          });
        }
        break;
    }
  }
  if (workflowJobRef !== void 0) {
    return {
      type: "reusableWorkflowJob",
      id: jobKey,
      name: jobName(name2, jobKey),
      needs: needs || [],
      if: ifCondition || new BasicExpressionToken(void 0, void 0, "success()", void 0, void 0, void 0),
      ref: workflowJobRef,
      "input-definitions": void 0,
      "input-values": workflowJobInputs,
      "secret-definitions": void 0,
      "secret-values": workflowJobSecrets,
      "inherit-secrets": inheritSecrets || void 0,
      outputs: void 0,
      concurrency,
      strategy
    };
  } else {
    return {
      type: "job",
      id: jobKey,
      name: jobName(name2, jobKey),
      needs,
      if: ifCondition || new BasicExpressionToken(void 0, void 0, "success()", void 0, void 0, void 0),
      env,
      concurrency,
      environment,
      strategy,
      "runs-on": runsOn,
      container,
      services,
      outputs,
      steps,
      snapshot
    };
  }
}
function jobName(name2, jobKey) {
  if (name2 === void 0) {
    return jobKey;
  }
  if (isString(name2) && name2.value === "") {
    return jobKey;
  }
  return name2;
}

// node_modules/@actions/workflow-parser/dist/model/converter/jobs.js
function convertJobs(context, token) {
  if (isMapping(token)) {
    const result = [];
    const jobsWithSatisfiedNeeds = [];
    const alljobsWithUnsatisfiedNeeds = [];
    for (const item of token) {
      const jobKey = item.key.assertString("job name");
      const jobDef = item.value.assertMapping(`job ${jobKey.value}`);
      const job = handleTemplateTokenErrors(token, context, void 0, () => convertJob(context, jobKey, jobDef));
      if (job) {
        result.push(job);
        const node = {
          name: job.id.value,
          needs: Object.assign([], job.needs)
        };
        if (node.needs.length > 0) {
          alljobsWithUnsatisfiedNeeds.push(node);
        } else {
          jobsWithSatisfiedNeeds.push(node);
        }
      }
    }
    validateNeeds(token, context, result, jobsWithSatisfiedNeeds, alljobsWithUnsatisfiedNeeds);
    return result;
  }
  context.error(token, "Invalid format for jobs");
  return [];
}
function validateNeeds(token, context, result, jobsWithSatisfiedNeeds, alljobsWithUnsatisfiedNeeds) {
  if (jobsWithSatisfiedNeeds.length == 0) {
    context.error(token, "The workflow must contain at least one job with no dependencies.");
    return;
  }
  while (jobsWithSatisfiedNeeds.length > 0) {
    const currentJob = jobsWithSatisfiedNeeds.shift();
    if (currentJob == void 0) {
      break;
    }
    for (let i = alljobsWithUnsatisfiedNeeds.length - 1; i >= 0; i--) {
      const unsatisfiedJob = alljobsWithUnsatisfiedNeeds[i];
      for (let j = unsatisfiedJob.needs.length - 1; j >= 0; j--) {
        const need = unsatisfiedJob.needs[j];
        if (need.value == currentJob.name) {
          unsatisfiedJob.needs.splice(j, 1);
          if (unsatisfiedJob.needs.length == 0) {
            jobsWithSatisfiedNeeds.push(unsatisfiedJob);
            alljobsWithUnsatisfiedNeeds.splice(i, 1);
          }
        }
      }
    }
  }
  if (alljobsWithUnsatisfiedNeeds.length > 0) {
    const jobNames = result.map((x) => x.id.value);
    for (const unsatisfiedJob of alljobsWithUnsatisfiedNeeds) {
      for (const need of unsatisfiedJob.needs) {
        if (jobNames.includes(need.value)) {
          context.error(need, `Job '${unsatisfiedJob.name}' depends on job '${need.value}' which creates a cycle in the dependency graph.`);
        } else {
          context.error(need, `Job '${unsatisfiedJob.name}' depends on unknown job '${need.value}'.`);
        }
      }
    }
  }
}

// node_modules/@actions/workflow-parser/dist/model/convert.js
var ErrorPolicy;
(function(ErrorPolicy2) {
  ErrorPolicy2[ErrorPolicy2["ReturnErrorsOnly"] = 0] = "ReturnErrorsOnly";
  ErrorPolicy2[ErrorPolicy2["TryConversion"] = 1] = "TryConversion";
})(ErrorPolicy || (ErrorPolicy = {}));
var defaultOptions = {
  maxReusableWorkflowDepth: 4,
  fetchReusableWorkflowDepth: 0,
  errorPolicy: ErrorPolicy.ReturnErrorsOnly,
  featureFlags: new FeatureFlags()
};

// src/core/parser.ts
var import_yaml2 = __toESM(require_dist(), 1);
function parseWorkflowFile(path, text) {
  const index = indexOn(path, text);
  const { context, value } = parseWorkflow(
    { name: path, content: text },
    new NoOperationTraceWriter()
  );
  if (value === void 0) return { ...index, ok: false, events: {} };
  const events = convert(context, value);
  return { ...index, ok: context.errors.getErrors().length === 0, events };
}
function convert(context, root) {
  let events = {};
  handleTemplateTokenErrors(root, context, void 0, () => {
    for (const item of root.assertMapping("root")) {
      const key = item.key.assertString("root key").value;
      const run = (fallback, f) => handleTemplateTokenErrors(root, context, fallback, f);
      if (key === "on") events = run({}, () => convertOn(context, item.value));
      if (key === "jobs") run([], () => convertJobs(context, item.value));
      if (key === "concurrency")
        run({}, () => convertConcurrency(context, item.value));
    }
  });
  return events;
}
function indexOn(path, text) {
  const lineCounter = new import_yaml2.LineCounter();
  const doc = (0, import_yaml2.parseDocument)(text, { lineCounter });
  const span = (node) => {
    const [start, end] = node.range ?? [0, 0];
    const a = lineCounter.linePos(start);
    const b = lineCounter.linePos(end);
    return { path, line: a.line, col: a.col, endLine: b.line, endCol: b.col };
  };
  const onEntries = /* @__PURE__ */ new Map();
  if (!(0, import_yaml2.isMap)(doc.contents)) return { onSpan: void 0, onEntries };
  const pair = doc.contents.items.find((p) => name(doc, p.key) === "on");
  if (!pair || !(0, import_yaml2.isScalar)(pair.key)) return { onSpan: void 0, onEntries };
  const own = (0, import_yaml2.isAlias)(pair.value) ? span(pair.value) : void 0;
  const value = resolve(doc, pair.value);
  const entries = (0, import_yaml2.isSeq)(value) ? value.items : (0, import_yaml2.isMap)(value) ? value.items.map((p) => p.key) : [value];
  for (const entry of entries) {
    const event = name(doc, entry);
    if (event !== void 0 && !onEntries.has(event))
      onEntries.set(event, own ?? span(entry));
  }
  return { onSpan: span(pair.key), onEntries };
}
function resolve(doc, node) {
  return (0, import_yaml2.isAlias)(node) ? node.resolve(doc) : node;
}
function name(doc, node) {
  const target = resolve(doc, node);
  return (0, import_yaml2.isScalar)(target) && typeof target.value === "string" ? target.value : void 0;
}
var RuntimeValueNeeded = class extends Error {
};
var stubs = [
  stub("success", 0, () => new data_exports.BooleanData(true)),
  stub("always", 0, () => new data_exports.BooleanData(true)),
  stub("failure", 0, () => new data_exports.BooleanData(false)),
  stub("cancelled", 0, () => new data_exports.BooleanData(false)),
  stub("hashFiles", 1, () => {
    throw new RuntimeValueNeeded("hashFiles()");
  })
];
function stub(name2, minArgs, call) {
  return { name: name2, minArgs, maxArgs: Number.MAX_SAFE_INTEGER, call };
}

// src/core/scenario.ts
var import_ajv = __toESM(require_ajv(), 1);

// schemas/scenario.schema.json
var scenario_schema_default = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://cdn.jsdelivr.net/npm/whynorun@1/schemas/scenario.schema.json",
  title: "Scenario",
  description: "Everything WhyNoRun is told about one situation: an Event, an optional Follow-up event, the Repo facts and any Assumptions. A saved Scenario writes every default out.",
  type: "object",
  additionalProperties: false,
  required: ["event", "repo"],
  properties: {
    event: { $ref: "#/definitions/event" },
    followUp: { $ref: "#/definitions/followUp" },
    repo: { $ref: "#/definitions/repo" },
    assume: {
      title: "Assumptions",
      description: 'Keyed by subject: a job key with "fails" (`"ci.yml \u203A test": "fails"`), or a job output keyed by the producing job (`"ci.yml \u203A changes \u203A outputs.src": "true"`). Values are strings, as GitHub\'s job outputs are.',
      type: "object",
      additionalProperties: { type: "string" }
    }
  },
  definitions: {
    name: {
      description: "The event name, such as push or pull_request.",
      type: "string",
      minLength: 1
    },
    type: {
      description: "The activity type; GitHub's defaults when omitted.",
      type: "string",
      minLength: 1
    },
    actor: {
      title: "ActorKind",
      description: "Who caused the Event: a member, a fork contributor or dependabot[bot].",
      enum: ["member", "fork", "dependabot"]
    },
    approval: {
      description: "Whether a fork contributor's run is approved.",
      enum: ["approved", "awaiting"]
    },
    ref: { description: "The ref the Event is for.", type: "string" },
    base: {
      description: "The base branch of a pull request.",
      type: "string"
    },
    changed: {
      description: "The changed files, taken as the complete diff.",
      type: "array",
      items: { type: "string" }
    },
    message: {
      description: "The head commit message.",
      type: "string"
    },
    payload: {
      title: "Payload",
      description: "github.event.* values the Event can't work out, as a nested object; a path read through .*.<field> holds a list of objects with that field.",
      type: "object"
    },
    login: {
      description: "The actor's login, for expressions comparing github.actor.",
      type: "string"
    },
    event: {
      title: "Event",
      type: "object",
      additionalProperties: false,
      required: ["name"],
      properties: {
        name: { $ref: "#/definitions/name" },
        type: { $ref: "#/definitions/type" },
        actor: { $ref: "#/definitions/actor" },
        approval: { $ref: "#/definitions/approval" },
        ref: { $ref: "#/definitions/ref" },
        base: { $ref: "#/definitions/base" },
        changed: { $ref: "#/definitions/changed" },
        message: { $ref: "#/definitions/message" },
        payload: { $ref: "#/definitions/payload" },
        login: { $ref: "#/definitions/login" }
      }
    },
    followUp: {
      title: "FollowUpEvent",
      description: "A second Event that arrives while the first Event's run (A) is still in progress or pending.",
      type: "object",
      additionalProperties: false,
      required: ["name"],
      properties: {
        name: { $ref: "#/definitions/name" },
        type: { $ref: "#/definitions/type" },
        actor: { $ref: "#/definitions/actor" },
        approval: { $ref: "#/definitions/approval" },
        ref: { $ref: "#/definitions/ref" },
        base: { $ref: "#/definitions/base" },
        changed: { $ref: "#/definitions/changed" },
        message: { $ref: "#/definitions/message" },
        payload: { $ref: "#/definitions/payload" },
        login: { $ref: "#/definitions/login" },
        runA: {
          description: "Run A's state when this Event arrives.",
          enum: ["in-progress", "pending"]
        },
        pendingRuns: {
          description: "How many runs already wait in a queue: max group.",
          type: "integer",
          minimum: 0
        }
      }
    },
    repo: {
      title: "RepoFacts",
      type: "object",
      additionalProperties: false,
      required: ["date"],
      properties: {
        date: {
          description: "The simulation date (YYYY-MM-DD). Required: it never defaults to today.",
          type: "string",
          pattern: "^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$"
        },
        visibility: { enum: ["public", "private", "internal"] },
        predates: {
          description: "Whether the repo was created before 2026-09-17.",
          type: "boolean"
        },
        tokenDefault: {
          description: "The GITHUB_TOKEN default permissions.",
          enum: ["restricted", "permissive"]
        },
        eventPolicy: {
          description: "The pull_request_target event policy.",
          enum: ["none", "allows", "blocks"]
        },
        defaultBranch: { type: "string", minLength: 1 },
        required: {
          description: "Required check names, as typed in branch protection.",
          type: "array",
          items: { type: "string" }
        },
        strict: {
          description: "Whether branches must be up to date before merging.",
          type: "boolean"
        },
        mergeQueue: { type: "boolean" },
        vars: {
          description: "Repository variables. Values are strings, as GitHub's are.",
          type: "object",
          additionalProperties: { type: "string" }
        },
        repository: {
          description: "owner/repo, with GitHub's owner and repo name characters.",
          type: "string",
          pattern: "^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})/(?!\\.\\.?$)[A-Za-z0-9._-]{1,100}$"
        }
      }
    }
  }
};

// src/core/scenario.ts
var validate = new import_ajv.default({ allErrors: true }).compile(scenario_schema_default);
function validateScenario(value) {
  if (validate(value)) return [];
  return (validate.errors ?? []).map(
    (e) => `${e.instancePath || "scenario"} ${e.message ?? "is invalid"}`
  );
}
var DEFAULTS = [
  { path: ["repo", "visibility"], value: "public", show: "Visibility: public" },
  {
    path: ["repo", "predates"],
    value: true,
    show: "Created before 2026-09-17: yes"
  },
  {
    path: ["repo", "defaultBranch"],
    value: "main",
    show: "Default branch: `main`"
  },
  {
    path: ["repo", "tokenDefault"],
    value: "restricted",
    show: "Token default: restricted"
  },
  {
    path: ["repo", "eventPolicy"],
    value: "none",
    show: "`pull_request_target` event policy: none"
  },
  {
    path: ["event", "approval"],
    value: "approved",
    show: "Approval of a fork contributor's run: approved"
  },
  { path: ["event", "actor"], value: "member" },
  { path: ["event", "changed"], value: [] },
  { path: ["event", "payload"], value: {} },
  { path: ["followUp", "actor"], value: "member" },
  { path: ["followUp", "approval"], value: "approved" },
  { path: ["followUp", "changed"], value: [] },
  { path: ["followUp", "payload"], value: {} },
  { path: ["followUp", "runA"], value: "in-progress" },
  { path: ["followUp", "pendingRuns"], value: 0 },
  { path: ["repo", "required"], value: [] },
  { path: ["repo", "strict"], value: false },
  { path: ["repo", "mergeQueue"], value: false },
  { path: ["repo", "vars"], value: {} },
  { path: ["assume"], value: {} }
];
var SHOW_DEFAULTS = DEFAULTS.flatMap(
  (d) => d.show ? [d.show] : []
);
var USER_MAPS = [
  ["event", "payload"],
  ["followUp", "payload"],
  ["repo", "vars"],
  ["assume"]
];
function withDefaults(input) {
  const scenario = JSON.parse(JSON.stringify(input));
  const filled = [];
  for (const { path, value } of DEFAULTS) {
    const parent = walk(scenario, path.slice(0, -1));
    const field = path.at(-1);
    if (parent === void 0 || Object.hasOwn(parent, field)) continue;
    parent[field] = JSON.parse(JSON.stringify(value));
    filled.push(path.join("."));
  }
  for (const path of USER_MAPS) {
    const parent = walk(scenario, path.slice(0, -1));
    const field = path.at(-1);
    if (parent && Object.hasOwn(parent, field))
      parent[field] = Object.assign(/* @__PURE__ */ Object.create(null), parent[field]);
  }
  return { scenario, filled };
}
function walk(node, path) {
  let at = node;
  for (const seg of path) {
    if (typeof at !== "object" || at === null || !Object.hasOwn(at, seg))
      return void 0;
    at = at[seg];
  }
  return typeof at === "object" && at !== null ? at : void 0;
}

// src/core/baseline.ts
var PLATFORM_BASELINE = [
  "Actions are enabled for the repo, org and enterprise, and the GitHub workflow isn't disabled (PL-1, PL-2).",
  "The event was created: no more than 3 tags or 5,000 branches pushed at once (PL-7), and no trigger or queue rate limit is hit (PL-8).",
  "The event wasn't caused by `GITHUB_TOKEN` (PL-6).",
  "No execution-protection actor rule, no event rule other than the `pull_request_target` event policy, and no Require-lockfile policy (PL-10, PRT-6, PRT-7).",
  "The allowed-actions and SHA-pinning policies permit every `uses:` (PL-11).",
  "The pull request has no merge conflict (PL-12, DB-5).",
  "Environment protection rules and branch policies pass (PL-16).",
  '"Allow GitHub Actions to create and approve pull requests" is on (PERM-10).',
  "No runner-queue, run or job time limit is hit (PL-15), and there is no billing or storage stop (PL-17)."
];

// src/core/rules.ts
var rows = [
  {
    id: "EV-0",
    text: "A run is created only for GitHub workflows whose `on:` lists the triggering event; an event not listed creates no run.",
    url: "https://docs.github.com/en/actions/concepts/workflows-and-actions/workflows",
    confidence: "High"
  },
  {
    id: "WN-3",
    text: "Outside v1: WhyNoRun doesn't simulate this Event.",
    url: "https://github.com/KunalKumarMehta/whynorun/issues/6",
    confidence: "High"
  }
];
var RULES = Object.fromEntries(
  rows.map((r) => [r.id, r])
);

// src/core/index.ts
var loaded = /^\.github\/workflows\/([^/]+\.ya?ml)$/;
function simulate(files, input) {
  const problems = validateScenario(input);
  if (problems.length > 0) throw new TypeError(problems.join("; "));
  const { event } = withDefaults(input).scenario;
  if (event.name !== "push" || event.actor !== "member") {
    const inputs = [
      { path: "event.name", value: event.name },
      { path: "event.actor", value: event.actor }
    ];
    return {
      verdicts: [
        {
          key: "event",
          value: "unsupported",
          causes: [{ rule: "WN-3", spans: [], inputs }]
        }
      ],
      diagnostics: []
    };
  }
  const verdicts = [];
  for (const file of files) {
    const key = loaded.exec(file.path)?.[1];
    if (key === void 0) continue;
    const parsed = parseWorkflowFile(file.path, file.text);
    if (!parsed.ok) continue;
    const listed = Object.hasOwn(parsed.events, event.name);
    const span = listed ? parsed.onEntries.get(event.name) : parsed.onSpan;
    verdicts.push({
      key,
      value: listed ? "runs" : "skipped",
      causes: [
        {
          rule: "EV-0",
          spans: span ? [span] : [],
          inputs: [{ path: "event.name", value: event.name }]
        }
      ]
    });
  }
  verdicts.sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  return { verdicts, diagnostics: [] };
}

// src/cli/main.ts
var USAGE = `usage: whynorun show --event <name> --date <YYYY-MM-DD> [--repo <dir>] [--flow access|all]
       whynorun --version
`;
function main(argv) {
  if (argv.length === 1 && argv[0] === "--version") {
    process.stdout.write(`whynorun ${"0.0.0"}
`);
    return 0;
  }
  if (argv[0] === "show") return show(argv.slice(1));
  return misuse();
}
function misuse(message) {
  process.stderr.write(message ? `whynorun: ${message}
${USAGE}` : USAGE);
  return 2;
}
function show(args) {
  let values;
  try {
    ({ values } = parseArgs({
      args,
      options: {
        event: { type: "string" },
        date: { type: "string" },
        repo: { type: "string", default: "." },
        flow: { type: "string", default: "all" }
      }
    }));
  } catch (err) {
    return misuse(err.message);
  }
  const { event, date, repo, flow } = values;
  if (flow === "checks" || flow === "concurrency")
    return misuse(
      `--flow ${flow} needs required checks or a Follow-up event, which flags can't describe: use --from <test file>`
    );
  if (flow !== "access" && flow !== "all")
    return misuse("--flow must be access, checks, concurrency or all");
  if (event === void 0) return misuse("show needs --event <name>");
  if (date === void 0)
    return misuse("show needs --date <YYYY-MM-DD>, the simulation date");
  const scenario = { event: { name: event }, repo: { date } };
  if (validateScenario(scenario).length > 0)
    return misuse(`--event or --date is invalid: --date must be YYYY-MM-DD`);
  const dir = join2(resolve2(repo), ".github", "workflows");
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return misuse(`no .github/workflows/ folder in ${resolve2(repo)}`);
  }
  const files = entries.filter((e) => e.isFile()).map((e) => ({
    path: `.github/workflows/${e.name}`,
    text: readFileSync(join2(dir, e.name), "utf8")
  }));
  const lines = simulate(files, scenario).verdicts.map((v) => {
    const root = v.causes[0];
    const line = root?.spans[0]?.line;
    return `${v.key}: ${v.value} (root ${root?.rule}${line ? `, line ${line}` : ""})`;
  });
  process.stdout.write(
    [
      `whynorun ${"0.0.0"}`,
      "",
      "What WhyNoRun always assumes:",
      ...PLATFORM_BASELINE.map((item) => `- ${item}`),
      "",
      ...lines,
      ""
    ].join("\n")
  );
  return 0;
}

// src/cli/index.ts
process.exitCode = main(process.argv.slice(2));
