YUI.add('node-base', function(Y) {

/**
 * The Node Utility provides a DOM-like interface for interacting with DOM nodes.
 * @module node
 * @submodule node-base
 */    

/**
 * The Node class provides a wrapper for manipulating DOM Nodes.
 * Node properties can be accessed via the set/get methods.
 * Use Y.get() to retrieve Node instances.
 *
 * <strong>NOTE:</strong> Node properties are accessed using
 * the <code>set</code> and <code>get</code> methods.
 *
 * @class Node
 * @constructor
 * @param {DOMNode} node the DOM node to be mapped to the Node instance.
 * @for Node
 */

// "globals"
var DOT = '.',
    NODE_NAME = 'nodeName',
    NODE_TYPE = 'nodeType',
    OWNER_DOCUMENT = 'ownerDocument',
    TAG_NAME = 'tagName',
    UID = '_yuid',

    Y_DOM = Y.DOM,

    Y_Node = function(node) {
        var uid = (node.nodeType !== 9) ? node.uniqueID : node[UID];

        if (uid && Y_Node._instances[uid] && Y_Node._instances[uid]._node !== node) {
            node[UID] = null; // unset existing uid to prevent collision (via clone or hack)
        }

        uid = uid || Y.stamp(node);
        if (!uid) { // stamp failed; likely IE non-HTMLElement
            uid = Y.guid();
        }

        this[UID] = uid;

        /**
         * The underlying DOM node bound to the Y.Node instance
         * @property _node
         * @private
         */
        this._node = node;
        Y_Node._instances[uid] = this;

        this._stateProxy = node; // when augmented with Attribute

        if (this._initPlugins) { // when augmented with Plugin.Host
            this._initPlugins();
        }
    },

    // used with previous/next/ancestor tests
    _wrapFn = function(fn) {
        var ret = null;
        if (fn) {
            ret = (typeof fn === 'string') ?
            function(n) {
                return Y.Selector.test(n, fn);
            } : 
            function(n) {
                return fn(Y.one(n));
            };
        }

        return ret;
    };
// end "globals"

/**
 * The name of the component 
 * @static
 * @property NAME
 */    
Y_Node.NAME = 'node';

/*
 * The pattern used to identify ARIA attributes 
 */    
Y_Node.re_aria = /^(?:role$|aria-)/;

/**
 * List of events that route to DOM events 
 * @static
 * @property DOM_EVENTS
 */    

Y_Node.DOM_EVENTS = {
    abort: 1,
    beforeunload: 1,
    blur: 1,
    change: 1,
    click: 1,
    close: 1,
    command: 1,
    contextmenu: 1,
    dblclick: 1,
    DOMMouseScroll: 1,
    drag: 1,
    dragstart: 1,
    dragenter: 1,
    dragover: 1,
    dragleave: 1,
    dragend: 1,
    drop: 1,
    error: 1,
    focus: 1,
    key: 1,
    keydown: 1,
    keypress: 1,
    keyup: 1,
    load: 1,
    message: 1,
    mousedown: 1,
    mouseenter: 1,
    mouseleave: 1,
    mousemove: 1,
    mousemultiwheel: 1,
    mouseout: 1, 
    mouseover: 1, 
    mouseup: 1,
    mousewheel: 1,
    reset: 1,
    resize: 1,
    select: 1,
    submit: 1,
    scroll: 1,
    textInput: 1,
    unload: 1
};

// Add custom event adaptors to this list.  This will make it so
// that delegate, key, available, contentready, etc all will
// be available through Node.on
Y.mix(Y_Node.DOM_EVENTS, Y.Env.evt.plugins);

/**
 * A list of Node instances that have been created 
 * @private
 * @property _instances
 * @static
 *
 */
Y_Node._instances = {};

/**
 * Retrieves the DOM node bound to a Node instance
 * @method getDOMNode
 * @static
 *
 * @param {Y.Node || HTMLNode} node The Node instance or an HTMLNode
 * @return {HTMLNode} The DOM node bound to the Node instance.  If a DOM node is passed
 * as the node argument, it is simply returned.
 */
Y_Node.getDOMNode = function(node) {
    if (node) {
        return (node.nodeType) ? node : node._node || null;
    }
    return null;
};
 
/**
 * Checks Node return values and wraps DOM Nodes as Y.Node instances
 * and DOM Collections / Arrays as Y.NodeList instances.
 * Other return values just pass thru.  If undefined is returned (e.g. no return)
 * then the Node instance is returned for chainability.
 * @method scrubVal
 * @static
 *
 * @param {any} node The Node instance or an HTMLNode
 * @return {Y.Node | Y.NodeList | any} Depends on what is returned from the DOM node.
 */
Y_Node.scrubVal = function(val, node) {
    if (node && val) { // only truthy values are risky
        if (typeof val === 'object' || typeof val === 'function') { // safari nodeList === function
            if (NODE_TYPE in val || Y_DOM.isWindow(val)) {// node || window
                val = Y.one(val);
            } else if ((val.item && !val._nodes) || // dom collection or Node instance
                    (val[0] && val[0][NODE_TYPE])) { // array of DOM Nodes
                val = Y.all(val);
            }
        }
    } else if (val === undefined) {
        val = node; // for chaining
    }

    return val;
};

/**
 * Adds methods to the Y.Node prototype, routing through scrubVal.
 * @method addMethod
 * @static
 *
 * @param {String} name The name of the method to add 
 * @param {Function} fn The function that becomes the method 
 * @param {Object} context An optional context to call the method with
 * (defaults to the Node instance)
 * @return {any} Depends on what is returned from the DOM node.
 */
Y_Node.addMethod = function(name, fn, context) {
    if (name && fn && typeof fn === 'function') {
        Y_Node.prototype[name] = function() {
            context = context || this;
            var args = Y.Array(arguments, 0, true),
                ret;

            if (args[0] && args[0] instanceof Y_Node) {
                args[0] = args[0]._node;
            }

            if (args[1] && args[1] instanceof Y_Node) {
                args[1] = args[1]._node;
            }
            args.unshift(this._node);
            ret = Y_Node.scrubVal(fn.apply(context, args), this);
            return ret;
        };
    } else {
        Y.log('unable to add method: ' + name, 'warn', 'Node');
    }
};

/**
 * Imports utility methods to be added as Y.Node methods.
 * @method importMethod
 * @static
 *
 * @param {Object} host The object that contains the method to import. 
 * @param {String} name The name of the method to import
 * @param {String} altName An optional name to use in place of the host name 
 * @param {Object} context An optional context to call the method with
 */
Y_Node.importMethod = function(host, name, altName) {
    if (typeof name === 'string') {
        altName = altName || name;
        Y_Node.addMethod(altName, host[name], host);
    } else {
        Y.Array.each(name, function(n) {
            Y_Node.importMethod(host, n);
        });
    }
};

/**
 * Returns a single Node instance bound to the node or the
 * first element matching the given selector. Returns null if no match found.
 * <strong>Note:</strong> For chaining purposes you may want to
 * use <code>Y.all</code>, which returns a NodeList when no match is found.
 * @method Y.one
 * @static
 * @param {String | HTMLElement} node a node or Selector 
 * @return {Y.Node | null} a Node instance or null if no match found.
 */
Y_Node.one = function(node) {
    var instance = null,
        cachedNode,
        uid;

    if (node) {
        if (typeof node === 'string') {
            if (node.indexOf('doc') === 0) { // doc OR document
                node = Y.config.doc;
            } else if (node.indexOf('win') === 0) { // win OR window
                node = Y.config.win;
            } else {
                node = Y.Selector.query(node, null, true);
            }
            if (!node) {
                return null;
            }
        } else if (node instanceof Y_Node) {
            return node; // NOTE: return
        }

        uid = (node.uniqueID && node.nodeType !== 9) ? node.uniqueID : node._yuid;
        instance = Y_Node._instances[uid]; // reuse exising instances
        cachedNode = instance ? instance._node : null;
        if (!instance || (cachedNode && node !== cachedNode)) { // new Node when nodes don't match
            instance = new Y_Node(node);
        }
    }
    return instance;
};

/**
 * Returns a single Node instance bound to the node or the
 * first element matching the given selector.
 * @method Y.get
 * @deprecated Use Y.one
 * @static
 * @param {String | HTMLElement} node a node or Selector 
 * @param {Y.Node || HTMLElement} doc an optional document to scan. Defaults to Y.config.doc. 
 */
Y_Node.get = function() {
    Y.log('Y.get is deprecated, use Y.one', 'warn', 'deprecated');
    return Y_Node.one.apply(Y_Node, arguments);
};

/**
 * Creates a new dom node using the provided markup string. 
 * @method create
 * @static
 * @param {String} html The markup used to create the element
 * @param {HTMLDocument} doc An optional document context 
 * @return {Node} A Node instance bound to a DOM node or fragment 
 */
Y_Node.create = function() {
    return Y.one(Y_DOM.create.apply(Y_DOM, arguments));
};

/**
 * Static collection of configuration attributes for special handling
 * @property ATTRS
 * @static
 * @type object
 */
Y_Node.ATTRS = {
    /**
     * Allows for getting and setting the text of an element.
     * Formatting is preserved and special characters are treated literally.
     * @config text
     * @type String
     */
    text: {
        getter: function() {
            return Y_DOM.getText(this._node);
        },

        setter: function(content) {
            Y_DOM.setText(this._node, content);
            return content;
        }
    },

    'options': {
        getter: function() {
            return this._node.getElementsByTagName('option');
        }
    },

    /**
     * Returns a NodeList instance of all HTMLElement children.
     * @readOnly
     * @config children
     * @type NodeList
     */
    'children': {
        getter: function() {
            var node = this._node,
                children = node.children,
                childNodes, i, len;

            if (!children) {
                childNodes = node.childNodes;
                children = [];

                for (i = 0, len = childNodes.length; i < len; ++i) {
                    if (childNodes[i][TAG_NAME]) {
                        children[children.length] = childNodes[i];
                    }
                }
            }
            return Y.all(children);
        }
    },

    value: {
        getter: function() {
            return Y_DOM.getValue(this._node);
        },

        setter: function(val) {
            Y_DOM.setValue(this._node, val);
            return val;
        }
    },
    
    
    /*
     * Flat data store for off-DOM usage 
     * @config data
     * @type any
     * @deprecated Use getData/setData
     */
    data: {
        getter: function() { 
            return this._dataVal; 
        },
        setter: function(val) { 
            this._dataVal = val;
            return val;
        },
        value: null
    }
};

/**
 * The default setter for DOM properties 
 * Called with instance context (this === the Node instance)
 * @method DEFAULT_SETTER
 * @static
 * @param {String} name The attribute/property being set 
 * @param {any} val The value to be set 
 * @return {any} The value
 */
Y_Node.DEFAULT_SETTER = function(name, val) {
    var node = this._stateProxy,
        strPath;

    if (name.indexOf(DOT) > -1) {
        strPath = name;
        name = name.split(DOT);
        // only allow when defined on node
        Y.Object.setValue(node, name, val);
    } else if (node[name] !== undefined) { // pass thru DOM properties 
        node[name] = val;
    }

    return val;
};

/**
 * The default getter for DOM properties 
 * Called with instance context (this === the Node instance)
 * @method DEFAULT_GETTER
 * @static
 * @param {String} name The attribute/property to look up 
 * @return {any} The current value
 */
Y_Node.DEFAULT_GETTER = function(name) {
    var node = this._stateProxy,
        val;

    if (name.indexOf && name.indexOf(DOT) > -1) {
        val = Y.Object.getValue(node, name.split(DOT));
    } else if (node[name] !== undefined) { // pass thru from DOM
        val = node[name];
    }

    return val;
};

Y.augment(Y_Node, Y.Event.Target);

Y.mix(Y_Node.prototype, {
/**
 * The method called when outputting Node instances as strings
 * @method toString
 * @return {String} A string representation of the Node instance 
 */
    toString: function() {
        var str = '',
            errorMsg = this[UID] + ': not bound to a node',
            node = this._node,
            id = (node.getAttribute) ? node.getAttribute('id') : node.id; // form.id may be a field name

        if (node) {
            str += node[NODE_NAME];
            if (id) {
                str += '#' + id; 
            }

            if (node.className) {
                str += '.' + node.className.replace(' ', '.'); 
            }

            // TODO: add yuid?
            str += ' ' + this[UID];
        }
        return str || errorMsg;
    },

    /**
     * Returns an attribute value on the Node instance.
     * Unless pre-configured (via Node.ATTRS), get hands 
     * off to the underlying DOM node.  Only valid
     * attributes/properties for the node will be set.
     * @method get
     * @param {String} attr The attribute
     * @return {any} The current value of the attribute
     */
    get: function(attr) {
        var val;

        if (this._getAttr) { // use Attribute imple
            val = this._getAttr(attr);
        } else {
            val = this._get(attr);
        }

        if (val) {
            val = Y_Node.scrubVal(val, this);
        }
        return val;
    },

    /**
     * Helper method for get.  
     * @method _get
     * @private
     * @param {String} attr The attribute
     * @return {any} The current value of the attribute
     */
    _get: function(attr) {
        var attrConfig = Y_Node.ATTRS[attr],
            val;

        if (attrConfig && attrConfig.getter) {
            val = attrConfig.getter.call(this);
        } else if (Y_Node.re_aria.test(attr)) {
            val = this._node.getAttribute(attr, 2); 
        } else {
            val = Y_Node.DEFAULT_GETTER.apply(this, arguments);
        }

        return val;
    },

    /**
     * Sets an attribute on the Node instance.
     * Unless pre-configured (via Node.ATTRS), set hands 
     * off to the underlying DOM node.  Only valid
     * attributes/properties for the node will be set.
     * To set custom attributes use setAttribute.
     * @method set
     * @param {String} attr The attribute to be set.  
     * @param {any} val The value to set the attribute to.  
     * @chainable
     */
    set: function(attr, val) {
        var attrConfig = Y_Node.ATTRS[attr];

        if (this._setAttr) { // use Attribute imple
            this._setAttr.apply(this, arguments);
        } else { // use setters inline
            if (attrConfig && attrConfig.setter) {
                attrConfig.setter.call(this, val);
            } else if (Y_Node.re_aria.test(attr)) { // special case Aria
                this._node.setAttribute(attr, val);
            } else {
                Y_Node.DEFAULT_SETTER.apply(this, arguments);
            }
        }

        return this;
    },

    /**
     * Sets multiple attributes. 
     * @method setAttrs
     * @param {Object} attrMap an object of name/value pairs to set  
     * @chainable
     */
    setAttrs: function(attrMap) {
        if (this._setAttrs) { // use Attribute imple
            this._setAttrs(attrMap);
        } else { // use setters inline
            Y.Object.each(attrMap, function(v, n) {
                this.set(n, v); 
            }, this);
        }

        return this;
    },

    /**
     * Returns an object containing the values for the requested attributes. 
     * @method getAttrs
     * @param {Array} attrs an array of attributes to get values  
     * @return {Object} An object with attribute name/value pairs.
     */
    getAttrs: function(attrs) {
        var ret = {};
        if (this._getAttrs) { // use Attribute imple
            this._getAttrs(attrs);
        } else { // use setters inline
            Y.Array.each(attrs, function(v, n) {
                ret[v] = this.get(v); 
            }, this);
        }

        return ret;
    },

    /**
     * Creates a new Node using the provided markup string. 
     * @method create
     * @param {String} html The markup used to create the element
     * @param {HTMLDocument} doc An optional document context 
     * @return {Node} A Node instance bound to a DOM node or fragment 
     */
    create: Y_Node.create,

    /**
     * Compares nodes to determine if they match.
     * Node instances can be compared to each other and/or HTMLElements.
     * @method compareTo
     * @param {HTMLElement | Node} refNode The reference node to compare to the node.
     * @return {Boolean} True if the nodes match, false if they do not. 
     */
    compareTo: function(refNode) {
        var node = this._node;
        if (refNode instanceof Y_Node) { 
            refNode = refNode._node;
        }
        return node === refNode;
    },

    /**
     * Determines whether the node is appended to the document.
     * @method inDoc
     * @param {Node|HTMLElement} doc optional An optional document to check against.
     * Defaults to current document. 
     * @return {Boolean} Whether or not this node is appended to the document. 
     */
    inDoc: function(doc) {
        var node = this._node;
        doc = (doc) ? doc._node || doc : node[OWNER_DOCUMENT];
        if (doc.documentElement) {
            return Y_DOM.contains(doc.documentElement, node);
        }
    },

    getById: function(id) {
        var node = this._node,
            ret = Y_DOM.byId(id, node[OWNER_DOCUMENT]);
        if (ret && Y_DOM.contains(node, ret)) {
            ret = Y.one(ret);
        } else {
            ret = null;
        }
        return ret;
    },

   /**
     * Returns the nearest ancestor that passes the test applied by supplied boolean method.
     * @method ancestor
     * @param {String | Function} fn A selector string or boolean method for testing elements.
     * @param {Boolean} testSelf optional Whether or not to include the element in the scan 
     * If a function is used, it receives the current node being tested as the only argument.
     * @return {Node} The matching Node instance or null if not found
     */
    ancestor: function(fn, testSelf) {
        return Y.one(Y_DOM.ancestor(this._node, _wrapFn(fn), testSelf));
    },

    /**
     * Returns the previous matching sibling. 
     * Returns the nearest element node sibling if no method provided.
     * @method previous
     * @param {String | Function} fn A selector or boolean method for testing elements.
     * If a function is used, it receives the current node being tested as the only argument.
     * @return {Node} Node instance or null if not found
     */
    previous: function(fn, all) {
        return Y.one(Y_DOM.elementByAxis(this._node, 'previousSibling', _wrapFn(fn), all));
    }, 

    /**
     * Returns the next matching sibling. 
     * Returns the nearest element node sibling if no method provided.
     * @method next
     * @param {String | Function} fn A selector or boolean method for testing elements.
     * If a function is used, it receives the current node being tested as the only argument.
     * @return {Node} Node instance or null if not found
     */
    next: function(fn, all) {
        return Y.one(Y_DOM.elementByAxis(this._node, 'nextSibling', _wrapFn(fn), all));
    },

    /**
     * Returns all matching siblings. 
     * Returns all siblings if no method provided.
     * @method siblings
     * @param {String | Function} fn A selector or boolean method for testing elements.
     * If a function is used, it receives the current node being tested as the only argument.
     * @return {NodeList} NodeList instance bound to found siblings
     */
    siblings: function(fn) {
        return Y.all(Y_DOM.siblings(this._node, _wrapFn(fn)));
    },
        
    /**
     * Retrieves a Node instance of nodes based on the given CSS selector. 
     * @method one
     *
     * @param {string} selector The CSS selector to test against.
     * @return {Node} A Node instance for the matching HTMLElement.
     */
    one: function(selector) {
        return Y.one(Y.Selector.query(selector, this._node, true));
    },

    /**
     * Retrieves a Node instance of nodes based on the given CSS selector. 
     * @method query
     * @deprecated Use one()
     * @param {string} selector The CSS selector to test against.
     * @return {Node} A Node instance for the matching HTMLElement.
     */
    query: function(selector) {
        Y.log('query() is deprecated, use one()', 'warn', 'deprecated');
        return this.one(selector);
    },

    /**
     * Retrieves a nodeList based on the given CSS selector. 
     * @method all
     *
     * @param {string} selector The CSS selector to test against.
     * @return {NodeList} A NodeList instance for the matching HTMLCollection/Array.
     */
    all: function(selector) {
        var nodelist = Y.all(Y.Selector.query(selector, this._node));
        nodelist._query = selector;
        nodelist._queryRoot = this._node;
        return nodelist;
    },

    /**
     * Retrieves a nodeList based on the given CSS selector. 
     * @method queryAll
     * @deprecated Use all()
     * @param {string} selector The CSS selector to test against.
     * @return {NodeList} A NodeList instance for the matching HTMLCollection/Array.
     */
    queryAll: function(selector) {
        Y.log('queryAll() is deprecated, use all()', 'warn', 'deprecated');
        return this.all(selector);
    },

    // TODO: allow fn test
    /**
     * Test if the supplied node matches the supplied selector.
     * @method test
     *
     * @param {string} selector The CSS selector to test against.
     * @return {boolean} Whether or not the node matches the selector.
     */
    test: function(selector) {
        return Y.Selector.test(this._node, selector);
    },

    /**
     * Removes the node from its parent.
     * Shortcut for myNode.get('parentNode').removeChild(myNode);
     * @method remove
     * @chainable
     *
     */
    remove: function(destroy) {
        var node = this._node,
            parentNode = node.parentNode;

        if (parentNode) {
            parentNode.removeChild(node); 
        }

        if (destroy) {
            this.destroy(true);
        }

        return this;
    },

    /**
     * Replace the node with the other node. This is a DOM update only
     * and does not change the node bound to the Node instance.
     * Shortcut for myNode.get('parentNode').replaceChild(newNode, myNode);
     * @method replace
     * @param {Y.Node || HTMLNode} newNode Node to be inserted
     * @chainable
     *
     */
    replace: function(newNode) {
        var node = this._node;
        node.parentNode.replaceChild(Y_Node.getDOMNode(newNode), node);
        return this;
    },

    /**
     * Removes event listeners from the node and (optionally) its subtree
     * @method purge
     * @param {Boolean} recurse (optional) Whether or not to remove listeners from the
     * node's subtree
     * @param {String} type (optional) Only remove listeners of the specified type
     * @chainable
     *
     */
    purge: function(recurse, type) {
        Y.Event.purgeElement(this._node, recurse, type);
        return this;
    },

    /**
     * Nulls internal node references, removes any plugins and event listeners
     * @method destroy
     * @param {Boolean} recursivePurge (optional) Whether or not to remove listeners from the
     * node's subtree (default is false)
     *
     */
    destroy: function(recursivePurge) {
        delete Y_Node._instances[this[UID]];
        this.purge(recursivePurge);

        if (this.unplug) { // may not be a PluginHost
            this.unplug();
        }

        this._node._yuid = null;
        this._node = null;
        this._stateProxy = null;
    },

    /**
     * Invokes a method on the Node instance 
     * @method invoke
     * @param {String} method The name of the method to invoke
     * @param {Any}  a, b, c, etc. Arguments to invoke the method with. 
     * @return Whatever the underly method returns. 
     * DOM Nodes and Collections return values
     * are converted to Node/NodeList instances.
     *
     */
    invoke: function(method, a, b, c, d, e) {
        var node = this._node,
            ret;

        if (a && a instanceof Y_Node) {
            a = a._node;
        }

        if (b && b instanceof Y_Node) {
            b = b._node;
        }

        ret = node[method](a, b, c, d, e);    
        return Y_Node.scrubVal(ret, this);
    },

    /**
     * Applies the given function to each Node in the NodeList.
     * @method each
     * @deprecated Use NodeList
     * @param {Function} fn The function to apply 
     * @param {Object} context optional An optional context to apply the function with
     * Default context is the NodeList instance
     * @chainable
     */
    each: function(fn, context) {
        context = context || this;
        Y.log('each is deprecated on Node', 'warn', 'deprecated');
        return fn.call(context, this);
    },

    /**
     * Retrieves the Node instance at the given index. 
     * @method item
     * @deprecated Use NodeList
     *
     * @param {Number} index The index of the target Node.
     * @return {Node} The Node instance at the given index.
     */
    item: function(index) {
        Y.log('item is deprecated on Node', 'warn', 'deprecated');
        return this;
    },

    /**
     * Returns the current number of items in the Node.
     * @method size
     * @deprecated Use NodeList
     * @return {Int} The number of items in the Node. 
     */
    size: function() {
        Y.log('size is deprecated on Node', 'warn', 'deprecated');
        return this._node ? 1 : 0;
    },

    /**
     * Inserts the content before the reference node. 
     * @method insert
     * @param {String | Y.Node | HTMLElement} content The content to insert 
     * @param {Int | Y.Node | HTMLElement | String} where The position to insert at.
     * Possible "where" arguments
     * <dl>
     * <dt>Y.Node</dt>
     * <dd>The Node to insert before</dd>
     * <dt>HTMLElement</dt>
     * <dd>The element to insert before</dd>
     * <dt>Int</dt>
     * <dd>The index of the child element to insert before</dd>
     * <dt>"replace"</dt>
     * <dd>Replaces the existing HTML</dd>
     * <dt>"before"</dt>
     * <dd>Inserts before the existing HTML</dd>
     * <dt>"before"</dt>
     * <dd>Inserts content before the node</dd>
     * <dt>"after"</dt>
     * <dd>Inserts content after the node</dd>
     * </dl>
     * @chainable
     */
    insert: function(content, where) {
        var node = this._node;

        if (content) {
            if (typeof where === 'number') { // allow index
                where = this._node.childNodes[where];
            } else if (where && where._node) { // Node
                where = where._node;
            }

            if (typeof content !== 'string') { // allow Node or NodeList/Array instances
                if (content._node) { // Node
                    content = content._node;
                } else if (content._nodes || (!content.nodeType && content.length)) { // NodeList or Array
                    content = Y.all(content);
                    Y.each(content._nodes, function(n) {
                        Y_DOM.addHTML(node, n, where);
                    });

                    return this; // NOTE: early return
                }
            }
            Y_DOM.addHTML(node, content, where);
        } else  {
            Y.log('unable to insert content ' + content, 'warn', 'node');
        }
        return this;
    },

    /**
     * Inserts the content as the firstChild of the node. 
     * @method prepend
     * @param {String | Y.Node | HTMLElement} content The content to insert 
     * @chainable
     */
    prepend: function(content) {
        return this.insert(content, 0);
    },

    /**
     * Inserts the content as the lastChild of the node. 
     * @method append
     * @param {String | Y.Node | HTMLElement} content The content to insert 
     * @chainable
     */
    append: function(content) {
        return this.insert(content, null);
    },

    /**
     * Replaces the node's current content with the content.
     * @method setContent
     * @param {String | Y.Node | HTMLElement} content The content to insert 
     * @chainable
     */
    setContent: function(content) {
        if (content) {
            if (content._node) { // map to DOMNode
                content = content._node;
            } else if (content._nodes) { // convert DOMNodeList to documentFragment
                content = Y_DOM._nl2frag(content._nodes);
            }

        }

        Y_DOM.addHTML(this._node, content, 'replace');
        return this;
    },

    /**
    * @method swap
    * @description Swap DOM locations with the given node.
    * This does not change which DOM node each Node instance refers to.
    * @param {Node} otherNode The node to swap with
     * @chainable
    */
    swap: Y.config.doc.documentElement.swapNode ? 
        function(otherNode) {
            this._node.swapNode(Y_Node.getDOMNode(otherNode));
        } :
        function(otherNode) {
            otherNode = Y_Node.getDOMNode(otherNode);
            var node = this._node,
                parent = otherNode.parentNode,
                nextSibling = otherNode.nextSibling;

            if (nextSibling === node) {
                parent.insertBefore(node, otherNode);
            } else if (otherNode === node.nextSibling) {
                parent.insertBefore(otherNode, node);
            } else {
                node.parentNode.replaceChild(otherNode, node);
                Y_DOM.addHTML(parent, node, nextSibling);
            }
            return this;
        },


    /**
    * @method getData
    * @description Retrieves arbitrary data stored on a Node instance.
    * This is not stored with the DOM node.
    * @param {string} name Optional name of the data field to retrieve.
    * If no name is given, all data is returned.
    * @return {any | Object} Whatever is stored at the given field,
    * or an object hash of all fields.
    */
    getData: function(name) {
        var ret;
        this._data = this._data || {};
        if (arguments.length) {
            ret = this._data[name];
        } else {
            ret = this._data;
        }

        return ret;
        
    },

    /**
    * @method setData
    * @description Stores arbitrary data on a Node instance.
    * This is not stored with the DOM node.
    * @param {string} name The name of the field to set. If no name
    * is given, name is treated as the data and overrides any existing data.
    * @param {any} val The value to be assigned to the field.
    * @chainable
    */
    setData: function(name, val) {
        this._data = this._data || {};
        if (arguments.length > 1) {
            this._data[name] = val;
        } else {
            this._data = name;
        }
       
       return this;
    },

    /**
    * @method clearData
    * @description Clears stored data. 
    * @param {string} name The name of the field to clear. If no name
    * is given, all data is cleared..
    * @chainable
    */
    clearData: function(name) {
        if (arguments.length) {
            delete this._data[name];
        } else {
            this._data = {};
        }

        return this;
    },

    hasMethod: function(method) {
        var node = this._node;
        return !!(node && method in node &&
                typeof node[method] !== 'unknown' &&
            (typeof node[method] === 'function' ||
                String(node[method]).indexOf('function') === 1)); // IE reports as object, prepends space
    }
}, true);

Y.Node = Y_Node;
Y.get = Y.Node.get;
Y.one = Y.Node.one;
/**
 * The NodeList module provides support for managing collections of Nodes.
 * @module node
 * @submodule nodelist
 */    

/**
 * The NodeList class provides a wrapper for manipulating DOM NodeLists.
 * NodeList properties can be accessed via the set/get methods.
 * Use Y.all() to retrieve NodeList instances.
 *
 * @class NodeList
 * @constructor
 */

var NodeList = function(nodes) {
    var tmp = [];
    if (typeof nodes === 'string') { // selector query
        this._query = nodes;
        nodes = Y.Selector.query(nodes);
    } else if (nodes.nodeType) { // domNode
        nodes = [nodes];
    } else if (nodes instanceof Y.Node) {
        nodes = [nodes._node];
    } else if (nodes[0] instanceof Y.Node) { // allow array of Y.Nodes
        Y.Array.each(nodes, function(node) {
            if (node._node) {
                tmp.push(node._node);
            }
        });
        nodes = tmp;
    } else { // array of domNodes or domNodeList (no mixed array of Y.Node/domNodes)
        nodes = Y.Array(nodes, 0, true);
    }

    /**
     * The underlying array of DOM nodes bound to the Y.NodeList instance
     * @property _nodes
     * @private
     */
    this._nodes = nodes;
};

NodeList.NAME = 'NodeList';

/**
 * Retrieves the DOM nodes bound to a NodeList instance
 * @method NodeList.getDOMNodes
 * @static
 *
 * @param {Y.NodeList} node The NodeList instance
 * @return {Array} The array of DOM nodes bound to the NodeList
 */
NodeList.getDOMNodes = function(nodeList) {
    return nodeList._nodes;
};

NodeList.each = function(instance, fn, context) {
    var nodes = instance._nodes;
    if (nodes && nodes.length) {
        Y.Array.each(nodes, fn, context || instance);
    } else {
        Y.log('no nodes bound to ' + this, 'warn', 'NodeList');
    }
};

NodeList.addMethod = function(name, fn, context) {
    if (name && fn) {
        NodeList.prototype[name] = function() {
            var ret = [],
                args = arguments;

            Y.Array.each(this._nodes, function(node) {
                var UID = (node.uniqueID && node.nodeType !== 9 ) ? 'uniqueID' : '_yuid',
                    instance = Y.Node._instances[node[UID]],
                    ctx,
                    result;

                if (!instance) {
                    instance = NodeList._getTempNode(node);
                }
                ctx = context || instance;
                result = fn.apply(ctx, args);
                if (result !== undefined && result !== instance) {
                    ret[ret.length] = result;
                }
            });

            // TODO: remove tmp pointer
            return ret.length ? ret : this;
        };
    } else {
        Y.log('unable to add method: ' + name + ' to NodeList', 'warn', 'node');
    }
};

NodeList.importMethod = function(host, name, altName) {
    if (typeof name === 'string') {
        altName = altName || name;
        NodeList.addMethod(name, host[name]);
    } else {
        Y.Array.each(name, function(n) {
            NodeList.importMethod(host, n);
        });
    }
};

NodeList._getTempNode = function(node) {
    var tmp = NodeList._tempNode;
    if (!tmp) {
        tmp = Y.Node.create('<div></div>');
        NodeList._tempNode = tmp;
    }

    tmp._node = node;
    tmp._stateProxy = node;
    return tmp;
};

Y.mix(NodeList.prototype, {
    /**
     * Retrieves the Node instance at the given index. 
     * @method item
     *
     * @param {Number} index The index of the target Node.
     * @return {Node} The Node instance at the given index.
     */
    item: function(index) {
        return Y.one((this._nodes || [])[index]);
    },

    /**
     * Applies the given function to each Node in the NodeList.
     * @method each
     * @param {Function} fn The function to apply. It receives 3 arguments:
     * the current node instance, the node's index, and the NodeList instance
     * @param {Object} context optional An optional context to apply the function with
     * Default context is the current Node instance
     * @chainable
     */
    each: function(fn, context) {
        var instance = this;
        Y.Array.each(this._nodes, function(node, index) {
            node = Y.one(node);
            return fn.call(context || node, node, index, instance);
        });
        return instance;
    },

    batch: function(fn, context) {
        var nodelist = this;

        Y.Array.each(this._nodes, function(node, index) {
            var instance = Y.Node._instances[node[UID]];
            if (!instance) {
                instance = NodeList._getTempNode(node);
            }

            return fn.call(context || instance, instance, index, nodelist);
        });
        return nodelist;
    },

    /**
     * Executes the function once for each node until a true value is returned.
     * @method some
     * @param {Function} fn The function to apply. It receives 3 arguments:
     * the current node instance, the node's index, and the NodeList instance
     * @param {Object} context optional An optional context to execute the function from.
     * Default context is the current Node instance
     * @return {Boolean} Whether or not the function returned true for any node.
     */
    some: function(fn, context) {
        var instance = this;
        return Y.Array.some(this._nodes, function(node, index) {
            node = Y.one(node);
            context = context || node;
            return fn.call(context, node, index, instance);
        });
    },

    /**
     * Creates a documenFragment from the nodes bound to the NodeList instance 
     * @method toFrag
     * @return Node a Node instance bound to the documentFragment
     */
    toFrag: function() {
        return Y.one(Y.DOM._nl2frag(this._nodes));
    },

    /**
     * Returns the index of the node in the NodeList instance
     * or -1 if the node isn't found.
     * @method indexOf
     * @param {Y.Node || DOMNode} node the node to search for
     * @return {Int} the index of the node value or -1 if not found
     */
    indexOf: function(node) {
        return Y.Array.indexOf(this._nodes, Y.Node.getDOMNode(node));
    },

    /**
     * Filters the NodeList instance down to only nodes matching the given selector.
     * @method filter
     * @param {String} selector The selector to filter against
     * @return {NodeList} NodeList containing the updated collection 
     * @see Selector
     */
    filter: function(selector) {
        return Y.all(Y.Selector.filter(this._nodes, selector));
    },


    /**
     * Creates a new NodeList containing all nodes at every n indices, where 
     * remainder n % index equals r.
     * (zero-based index).
     * @method modulus
     * @param {Int} n The offset to use (return every nth node)
     * @param {Int} r An optional remainder to use with the modulus operation (defaults to zero) 
     * @return {NodeList} NodeList containing the updated collection 
     */
    modulus: function(n, r) {
        r = r || 0;
        var nodes = [];
        NodeList.each(this, function(node, i) {
            if (i % n === r) {
                nodes.push(node);
            }
        });

        return Y.all(nodes);
    },

    /**
     * Creates a new NodeList containing all nodes at odd indices
     * (zero-based index).
     * @method odd
     * @return {NodeList} NodeList containing the updated collection 
     */
    odd: function() {
        return this.modulus(2, 1);
    },

    /**
     * Creates a new NodeList containing all nodes at even indices
     * (zero-based index), including zero. 
     * @method even
     * @return {NodeList} NodeList containing the updated collection 
     */
    even: function() {
        return this.modulus(2);
    },

    destructor: function() {
    },

    /**
     * Reruns the initial query, when created using a selector query 
     * @method refresh
     * @chainable
     */
    refresh: function() {
        var doc,
            nodes = this._nodes,
            query = this._query,
            root = this._queryRoot;

        if (query) {
            if (!root) {
                if (nodes && nodes[0] && nodes[0].ownerDocument) {
                    root = nodes[0].ownerDocument;
                }
            }

            this._nodes = Y.Selector.query(query, root);
        }

        return this;
    },

    /**
     * Applies an event listener to each Node bound to the NodeList. 
     * @method on
     * @param {String} type The event being listened for
     * @param {Function} fn The handler to call when the event fires
     * @param {Object} context The context to call the handler with.
     * Default is the NodeList instance. 
     * @return {Object} Returns an event handle that can later be use to detach(). 
     * @see Event.on
     */
    on: function(type, fn, context) {
        var args = Y.Array(arguments, 0, true);
        args.splice(2, 0, this._nodes);
        args[3] = context || this;
        return Y.on.apply(Y, args);
    },

    /**
     * Applies an event listener to each Node bound to the NodeList. 
     * The handler is called only after all on() handlers are called
     * and the event is not prevented.
     * @method after
     * @param {String} type The event being listened for
     * @param {Function} fn The handler to call when the event fires
     * @param {Object} context The context to call the handler with.
     * Default is the NodeList instance. 
     * @return {Object} Returns an event handle that can later be use to detach(). 
     * @see Event.on
     */
    after: function(type, fn, context) {
        var args = Y.Array(arguments, 0, true);
        args.splice(2, 0, this._nodes);
        args[3] = context || this;
        return Y.after.apply(Y, args);
    },

    /**
     * Returns the current number of items in the NodeList.
     * @method size
     * @return {Int} The number of items in the NodeList. 
     */
    size: function() {
        return this._nodes.length;
    },

    /**
     * Determines if the instance is bound to any nodes
     * @method isEmpty
     * @return {Boolean} Whether or not the NodeList is bound to any nodes 
     */
    isEmpty: function() {
        return this._nodes.length < 1;
    },

    toString: function() {
        var str = '',
            errorMsg = this[UID] + ': not bound to any nodes',
            nodes = this._nodes,
            node;

        if (nodes && nodes[0]) {
            node = nodes[0];
            str += node[NODE_NAME];
            if (node.id) {
                str += '#' + node.id; 
            }

            if (node.className) {
                str += '.' + node.className.replace(' ', '.'); 
            }

            if (nodes.length > 1) {
                str += '...[' + nodes.length + ' items]';
            }
        }
        return str || errorMsg;
    }

}, true);

NodeList.importMethod(Y.Node.prototype, [
    /**
     * Called on each Node instance
     * @for NodeList
     * @method append
     * @see Node.append
     */
    'append',

    /**
      * Called on each Node instance
      * @method detach
      * @see Node.detach
      */
    'detach',
    
    /** Called on each Node instance
      * @method detachAll
      * @see Node.detachAll
      */
    'detachAll',

    /** Called on each Node instance
      * @method insert
      * @see NodeInsert
      */
    'insert',

    /** Called on each Node instance
      * @method prepend
      * @see Node.prepend
      */
    'prepend',

    /** Called on each Node instance
      * @method remove
      * @see Node.remove
      */
    'remove',

    /** Called on each Node instance
      * @method set
      * @see Node.set
      */
    'set',

    /** Called on each Node instance
      * @method setContent
      * @see Node.setContent
      */
    'setContent'
]);

// one-off implementation to convert array of Nodes to NodeList
// e.g. Y.all('input').get('parentNode');

/** Called on each Node instance
  * @method get
  * @see Node
  */
NodeList.prototype.get = function(attr) {
    var ret = [],
        nodes = this._nodes,
        isNodeList = false,
        getTemp = NodeList._getTempNode,
        instance,
        val;

    if (nodes[0]) {
        instance = Y.Node._instances[nodes[0]._yuid] || getTemp(nodes[0]);
        val = instance._get(attr);
        if (val && val.nodeType) {
            isNodeList = true;
        }
    }

    Y.Array.each(nodes, function(node) {
        instance = Y.Node._instances[node._yuid];

        if (!instance) {
            instance = getTemp(node);
        }

        val = instance._get(attr);
        if (!isNodeList) { // convert array of Nodes to NodeList
            val = Y.Node.scrubVal(val, instance);
        }

        ret.push(val);
    });

    return (isNodeList) ? Y.all(ret) : ret;
};

Y.NodeList = NodeList;

Y.all = function(nodes) {
    return new NodeList(nodes);
};

Y.Node.all = Y.all;
Y.Array.each([
    /**
     * Passes through to DOM method.
     * @method replaceChild
     * @for Node
     * @param {HTMLElement | Node} node Node to be inserted 
     * @param {HTMLElement | Node} refNode Node to be replaced 
     * @return {Node} The replaced node 
     */
    'replaceChild',

    /**
     * Passes through to DOM method.
     * @method appendChild
     * @param {HTMLElement | Node} node Node to be appended 
     * @return {Node} The appended node 
     */
    'appendChild',

    /**
     * Passes through to DOM method.
     * @method insertBefore
     * @param {HTMLElement | Node} newNode Node to be appended 
     * @param {HTMLElement | Node} refNode Node to be inserted before 
     * @return {Node} The inserted node 
     */
    'insertBefore',

    /**
     * Passes through to DOM method.
     * @method removeChild
     * @param {HTMLElement | Node} node Node to be removed 
     * @return {Node} The removed node 
     */
    'removeChild',

    /**
     * Passes through to DOM method.
     * @method hasChildNodes
     * @return {Boolean} Whether or not the node has any childNodes 
     */
    'hasChildNodes',

    /**
     * Passes through to DOM method.
     * @method cloneNode
     * @param {Boolean} deep Whether or not to perform a deep clone, which includes
     * subtree and attributes
     * @return {Node} The clone 
     */
    'cloneNode',

    /**
     * Passes through to DOM method.
     * @method hasAttribute
     * @param {String} attribute The attribute to test for 
     * @return {Boolean} Whether or not the attribute is present 
     */
    'hasAttribute',

    /**
     * Passes through to DOM method.
     * @method removeAttribute
     * @param {String} attribute The attribute to be removed 
     * @chainable
     */
    'removeAttribute',

    /**
     * Passes through to DOM method.
     * @method scrollIntoView
     * @chainable
     */
    'scrollIntoView',

    /**
     * Passes through to DOM method.
     * @method getElementsByTagName
     * @param {String} tagName The tagName to collect 
     * @return {NodeList} A NodeList representing the HTMLCollection
     */
    'getElementsByTagName',

    /**
     * Passes through to DOM method.
     * @method focus
     * @chainable
     */
    'focus',

    /**
     * Passes through to DOM method.
     * @method blur
     * @chainable
     */
    'blur',

    /**
     * Passes through to DOM method.
     * Only valid on FORM elements
     * @method submit
     * @chainable
     */
    'submit',

    /**
     * Passes through to DOM method.
     * Only valid on FORM elements
     * @method reset
     * @chainable
     */
    'reset',

    /**
     * Passes through to DOM method.
     * @method select
     * @chainable
     */
     'select'
], function(method) {
    Y.Node.prototype[method] = function(arg1, arg2, arg3) {
    Y.log('adding: ' + method, 'info', 'node');
        var ret = this.invoke(method, arg1, arg2, arg3);
        return ret;
    };
});

Y.Node.importMethod(Y.DOM, [
    /**
     * Determines whether the node is an ancestor of another HTML element in the DOM hierarchy.
     * @method contains
     * @param {Node | HTMLElement} needle The possible node or descendent
     * @return {Boolean} Whether or not this node is the needle its ancestor
     */
    'contains',
    /**
     * Allows setting attributes on DOM nodes, normalizing in some cases.
     * This passes through to the DOM node, allowing for custom attributes.
     * @method setAttribute
     * @for Node
     * @for NodeList
     * @chainable
     * @param {string} name The attribute name 
     * @param {string} value The value to set
     */
    'setAttribute',
    /**
     * Allows getting attributes on DOM nodes, normalizing in some cases.
     * This passes through to the DOM node, allowing for custom attributes.
     * @method getAttribute
     * @for Node
     * @for NodeList
     * @param {string} name The attribute name 
     * @return {string} The attribute value 
     */
    'getAttribute'
]);

/**
 * Allows setting attributes on DOM nodes, normalizing in some cases.
 * This passes through to the DOM node, allowing for custom attributes.
 * @method setAttribute
 * @see Node
 * @for NodeList
 * @chainable
 * @param {string} name The attribute name 
 * @param {string} value The value to set
 */

/**
 * Allows getting attributes on DOM nodes, normalizing in some cases.
 * This passes through to the DOM node, allowing for custom attributes.
 * @method getAttribute
 * @see Node
 * @for NodeList
 * @param {string} name The attribute name 
 * @return {string} The attribute value 
 */

/**
 * Allows for removing attributes on DOM nodes.
 * This passes through to the DOM node, allowing for custom attributes.
 * @method removeAttribute
 * @see Node
 * @for NodeList
 * @param {string} name The attribute to remove 
 */
Y.NodeList.importMethod(Y.Node.prototype, ['getAttribute', 'setAttribute', 'removeAttribute']);
(function(Y) {
    var methods = [
    /**
     * Determines whether each node has the given className.
     * @method hasClass
     * @for Node
     * @param {String} className the class name to search for
     * @return {Array} An array of booleans for each node bound to the NodeList. 
     */
     'hasClass',

    /**
     * Adds a class name to each node.
     * @method addClass         
     * @param {String} className the class name to add to the node's class attribute
     * @chainable
     */
     'addClass',

    /**
     * Removes a class name from each node.
     * @method removeClass         
     * @param {String} className the class name to remove from the node's class attribute
     * @chainable
     */
     'removeClass',

    /**
     * Replace a class with another class for each node.
     * If no oldClassName is present, the newClassName is simply added.
     * @method replaceClass  
     * @param {String} oldClassName the class name to be replaced
     * @param {String} newClassName the class name that will be replacing the old class name
     * @chainable
     */
     'replaceClass',

    /**
     * If the className exists on the node it is removed, if it doesn't exist it is added.
     * @method toggleClass  
     * @param {String} className the class name to be toggled
     * @chainable
     */
     'toggleClass'
    ];

    Y.Node.importMethod(Y.DOM, methods);
    /**
     * Determines whether each node has the given className.
     * @method hasClass
     * @see Node.hasClass
     * @for NodeList
     * @param {String} className the class name to search for
     * @return {Array} An array of booleans for each node bound to the NodeList. 
     */

    /**
     * Adds a class name to each node.
     * @method addClass         
     * @see Node.addClass
     * @param {String} className the class name to add to the node's class attribute
     * @chainable
     */

    /**
     * Removes a class name from each node.
     * @method removeClass         
     * @see Node.removeClass
     * @param {String} className the class name to remove from the node's class attribute
     * @chainable
     */

    /**
     * Replace a class with another class for each node.
     * If no oldClassName is present, the newClassName is simply added.
     * @method replaceClass  
     * @see Node.replaceClass
     * @param {String} oldClassName the class name to be replaced
     * @param {String} newClassName the class name that will be replacing the old class name
     * @chainable
     */

    /**
     * If the className exists on the node it is removed, if it doesn't exist it is added.
     * @method toggleClass  
     * @see Node.toggleClass
     * @param {String} className the class name to be toggled
     * @chainable
     */
    Y.NodeList.importMethod(Y.Node.prototype, methods);
})(Y);

if (!Y.config.doc.documentElement.hasAttribute) { // IE < 8
    Y.Node.prototype.hasAttribute = function(attr) {
        if (attr === 'value') {
            if (this.get('value') !== "") { // IE < 8 fails to populate specified when set in HTML
                return true;
            }
        }
        return !!(this._node.attributes[attr] &&
                this._node.attributes[attr].specified);
    };
}

// IE throws error when setting input.type = 'hidden',
// input.setAttribute('type', 'hidden') and input.attributes.type.value = 'hidden'
Y.Node.ATTRS.type = {
    setter: function(val) {
        if (val === 'hidden') {
            try {
                this._node.type = 'hidden';
            } catch(e) {
                this.setStyle('display', 'none');
                this._inputType = 'hidden';
            }
        } else {
            try { // IE errors when changing the type from "hidden'
                this._node.type = val;
            } catch (e) {
                Y.log('error setting type: ' + val, 'info', 'node');
            }
        }
        return val;
    },

    getter: function() {
        return this._inputType || this._node.type;
    },

    _bypassProxy: true // don't update DOM when using with Attribute
};

if (Y.config.doc.createElement('form').elements.nodeType) {
    // IE: elements collection is also FORM node which trips up scrubVal.
    Y.Node.ATTRS.elements = {
            getter: function() {
                return this.all('input, textarea, button, select');
            }
    };
}



}, '@VERSION@' ,{requires:['dom-base', 'selector-css2', 'event-base']});
YUI.add('node-style', function(Y) {

(function(Y) {
/**
 * Extended Node interface for managing node styles.
 * @module node
 * @submodule node-style
 */

var methods = [
    /**
     * Returns the style's current value.
     * @method getStyle
     * @for Node
     * @param {String} attr The style attribute to retrieve. 
     * @return {String} The current value of the style property for the element.
     */
    'getStyle',

    /**
     * Returns the computed value for the given style property.
     * @method getComputedStyle
     * @param {String} attr The style attribute to retrieve. 
     * @return {String} The computed value of the style property for the element.
     */
    'getComputedStyle',

    /**
     * Sets a style property of the node.
     * @method setStyle
     * @param {String} attr The style attribute to set. 
     * @param {String|Number} val The value. 
     * @chainable
     */
    'setStyle',

    /**
     * Sets multiple style properties on the node.
     * @method setStyles
     * @param {Object} hash An object literal of property:value pairs. 
     * @chainable
     */
    'setStyles'
];
Y.Node.importMethod(Y.DOM, methods);
/**
 * Returns an array of values for each node.
 * @method getStyle
 * @for NodeList
 * @see Node.getStyle
 * @param {String} attr The style attribute to retrieve. 
 * @return {Array} The current values of the style property for the element.
 */

/**
 * Returns an array of the computed value for each node.
 * @method getComputedStyle
 * @see Node.getComputedStyle
 * @param {String} attr The style attribute to retrieve. 
 * @return {Array} The computed values for each node.
 */

/**
 * Sets a style property on each node.
 * @method setStyle
 * @see Node.setStyle
 * @param {String} attr The style attribute to set. 
 * @param {String|Number} val The value. 
 * @chainable
 */

/**
 * Sets multiple style properties on each node.
 * @method setStyles
 * @see Node.setStyles
 * @param {Object} hash An object literal of property:value pairs. 
 * @chainable
 */
Y.NodeList.importMethod(Y.Node.prototype, methods);
})(Y);
Y.mix(Y.Node.ATTRS, {
    offsetHeight: {
        setter: function(h) {
            Y.DOM.setHeight(this._node, h);
            return h;
        },

        getter: function() {
            return this._node.offsetHeight;
        }
    },

    offsetWidth: {
        setter: function(w) {
            Y.DOM.setWidth(this._node, w);
            return w;
        },

        getter: function() {
            return this._node.offsetWidth;
        }
    }
});

Y.mix(Y.Node.prototype, {
    sizeTo: function(w, h) {
        var node;
        if (arguments.length < 2) {
            node = Y.one(w);
            w = node.get('offsetWidth');
            h = node.get('offsetHeight');
        }

        this.setAttrs({
            offsetWidth: w,
            offsetHeight: h
        });
    }
});


}, '@VERSION@' ,{requires:['dom-style', 'node-base']});
YUI.add('node-screen', function(Y) {

/**
 * Extended Node interface for managing regions and screen positioning.
 * Adds support for positioning elements and normalizes window size and scroll detection. 
 * @module node
 * @submodule node-screen
 */

// these are all "safe" returns, no wrapping required
Y.each([
    /**
     * Returns the inner width of the viewport (exludes scrollbar). 
     * @config winWidth
     * @for Node
     * @type {Int}
     */
    'winWidth',

    /**
     * Returns the inner height of the viewport (exludes scrollbar). 
     * @config winHeight
     * @type {Int}
     */
    'winHeight',

    /**
     * Document width 
     * @config winHeight
     * @type {Int}
     */
    'docWidth',

    /**
     * Document height 
     * @config docHeight
     * @type {Int}
     */
    'docHeight',

    /**
     * Amount page has been scroll vertically 
     * @config docScrollX
     * @type {Int}
     */
    'docScrollX',

    /**
     * Amount page has been scroll horizontally 
     * @config docScrollY
     * @type {Int}
     */
    'docScrollY'
    ],
    function(name) {
        Y.Node.ATTRS[name] = {
            getter: function() {
                var args = Array.prototype.slice.call(arguments);
                args.unshift(Y.Node.getDOMNode(this));

                return Y.DOM[name].apply(this, args);
            }
        };
    }
);

Y.Node.ATTRS.scrollLeft = {
    getter: function() {
        var node = Y.Node.getDOMNode(this);
        return ('scrollLeft' in node) ? node.scrollLeft : Y.DOM.docScrollX(node);
    },

    setter: function(val) {
        var node = Y.Node.getDOMNode(this);
        if (node) {
            if ('scrollLeft' in node) {
                node.scrollLeft = val;
            } else if (node.document || node.nodeType === 9) {
                Y.DOM._getWin(node).scrollTo(val, Y.DOM.docScrollY(node)); // scroll window if win or doc
            }
        } else {
            Y.log('unable to set scrollLeft for ' + node, 'error', 'Node');
        }
    }
};

Y.Node.ATTRS.scrollTop = {
    getter: function() {
        var node = Y.Node.getDOMNode(this);
        return ('scrollTop' in node) ? node.scrollTop : Y.DOM.docScrollY(node);
    },

    setter: function(val) {
        var node = Y.Node.getDOMNode(this);
        if (node) {
            if ('scrollTop' in node) {
                node.scrollTop = val;
            } else if (node.document || node.nodeType === 9) {
                Y.DOM._getWin(node).scrollTo(Y.DOM.docScrollX(node), val); // scroll window if win or doc
            }
        } else {
            Y.log('unable to set scrollTop for ' + node, 'error', 'Node');
        }
    }
};

Y.Node.importMethod(Y.DOM, [
/**
 * Gets the current position of the node in page coordinates. 
 * @method getXY
 * @for Node
 * @return {Array} The XY position of the node
*/
    'getXY',

/**
 * Set the position of the node in page coordinates, regardless of how the node is positioned.
 * @method setXY
 * @param {Array} xy Contains X & Y values for new position (coordinates are page-based)
 * @chainable
 */
    'setXY',

/**
 * Gets the current position of the node in page coordinates. 
 * @method getX
 * @return {Int} The X position of the node
*/
    'getX',

/**
 * Set the position of the node in page coordinates, regardless of how the node is positioned.
 * @method setX
 * @param {Int} x X value for new position (coordinates are page-based)
 * @chainable
 */
    'setX',

/**
 * Gets the current position of the node in page coordinates. 
 * @method getY
 * @return {Int} The Y position of the node
*/
    'getY',

/**
 * Set the position of the node in page coordinates, regardless of how the node is positioned.
 * @method setY
 * @param {Int} y Y value for new position (coordinates are page-based)
 * @chainable
 */
    'setY',

/**
 * Swaps the XY position of this node with another node. 
 * @method swapXY
 * @param {Y.Node || HTMLElement} otherNode The node to swap with.
 * @chainable
 */
    'swapXY'
]);

/**
 * Returns a region object for the node 
 * @config region
 * @for Node
 * @type Node
 */
Y.Node.ATTRS.region = {
    getter: function() {
        var node = Y.Node.getDOMNode(this),
            region;

        if (node && !node.tagName) {
            if (node.nodeType === 9) { // document
                node = node.documentElement;
            }
        }
        if (node.alert) {
            region = Y.DOM.viewportRegion(node);
        } else {
            region = Y.DOM.region(node);
        }
        return region; 
    }
};
    
/**
 * Returns a region object for the node's viewport 
 * @config viewportRegion
 * @type Node
 */
Y.Node.ATTRS.viewportRegion = {
    getter: function() {
        return Y.DOM.viewportRegion(Y.Node.getDOMNode(this));
    }
};

Y.Node.importMethod(Y.DOM, 'inViewportRegion');

// these need special treatment to extract 2nd node arg
/**
 * Compares the intersection of the node with another node or region 
 * @method intersect         
 * @for Node
 * @param {Node|Object} node2 The node or region to compare with.
 * @param {Object} altRegion An alternate region to use (rather than this node's). 
 * @return {Object} An object representing the intersection of the regions. 
 */
Y.Node.prototype.intersect = function(node2, altRegion) {
    var node1 = Y.Node.getDOMNode(this);
    if (node2 instanceof Y.Node) { // might be a region object
        node2 = Y.Node.getDOMNode(node2);
    }
    return Y.DOM.intersect(node1, node2, altRegion); 
};

/**
 * Determines whether or not the node is within the giving region.
 * @method inRegion         
 * @param {Node|Object} node2 The node or region to compare with.
 * @param {Boolean} all Whether or not all of the node must be in the region. 
 * @param {Object} altRegion An alternate region to use (rather than this node's). 
 * @return {Object} An object representing the intersection of the regions. 
 */
Y.Node.prototype.inRegion = function(node2, all, altRegion) {
    var node1 = Y.Node.getDOMNode(this);
    if (node2 instanceof Y.Node) { // might be a region object
        node2 = Y.Node.getDOMNode(node2);
    }
    return Y.DOM.inRegion(node1, node2, all, altRegion); 
};


}, '@VERSION@' ,{requires:['dom-screen']});
YUI.add('node-pluginhost', function(Y) {

/**
 * Registers plugins to be instantiated at the class level (plugins 
 * which should be plugged into every instance of Node by default).
 *
 * @method Node.plug
 * @static
 *
 * @param {Function | Array} plugin Either the plugin class, an array of plugin classes or an array of objects (with fn and cfg properties defined)
 * @param {Object} config (Optional) If plugin is the plugin class, the configuration for the plugin
 */
Y.Node.plug = function() {
    var args = Y.Array(arguments);
    args.unshift(Y.Node);
    Y.Plugin.Host.plug.apply(Y.Base, args);
    return Y.Node;
};

/**
 * Unregisters any class level plugins which have been registered by the Node
 *
 * @method Node.unplug
 * @static
 *
 * @param {Function | Array} plugin The plugin class, or an array of plugin classes
 */
Y.Node.unplug = function() {
    var args = Y.Array(arguments);
    args.unshift(Y.Node);
    Y.Plugin.Host.unplug.apply(Y.Base, args);
    return Y.Node;
};

Y.mix(Y.Node, Y.Plugin.Host, false, null, 1);

// allow batching of plug/unplug via NodeList
// doesn't use NodeList.importMethod because we need real Nodes (not tmpNode)
Y.NodeList.prototype.plug = function() {
    var args = arguments;
    Y.NodeList.each(this, function(node) {
        Y.Node.prototype.plug.apply(Y.one(node), args);
    });
};

Y.NodeList.prototype.unplug = function() {
    var args = arguments;
    Y.NodeList.each(this, function(node) {
        Y.Node.prototype.unplug.apply(Y.one(node), args);
    });
};


}, '@VERSION@' ,{requires:['node-base', 'pluginhost']});
YUI.add('node-event-delegate', function(Y) {

/**
 * Functionality to make the node a delegated event container
 * @module node
 * @submodule node-event-delegate
 */

/**
 * Functionality to make the node a delegated event container
 * @method delegate
 * @param type {String} the event type to delegate
 * @param fn {Function} the function to execute
 * @param selector {String} a selector that must match the target of the event.
 * @return {Event.Handle} the detach handle
 * @for Node
 */
Y.Node.prototype.delegate = function(type, fn, selector) {

    var args = Array.prototype.slice.call(arguments, 3),
        a = [type, fn, Y.Node.getDOMNode(this), selector];
    a = a.concat(args);

    return Y.delegate.apply(Y, a);
};


}, '@VERSION@' ,{requires:['node-base', 'event-delegate', 'pluginhost']});


YUI.add('node', function(Y){}, '@VERSION@' ,{requires:['dom', 'event-base', 'event-delegate', 'pluginhost'], use:['node-base', 'node-style', 'node-screen', 'node-pluginhost', 'node-event-delegate'], skinnable:false});

