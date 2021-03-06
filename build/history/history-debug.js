YUI.add('history-base', function(Y) {

/**
 * Provides browser history management functionality using a simple
 * add/replace/get paradigm. This can be used to ensure that the browser's back
 * and forward buttons work as the user expects and to provide bookmarkable URLs
 * that return the user to the current application state, even in an Ajax
 * application that doesn't perform full-page refreshes.
 *
 * @module history
 * @since 3.2.0
 */

/**
 * The history-base module uses a simple object to store state. To integrate
 * state management with browser history and allow the back/forward buttons to
 * navigate between states, use history-hash.
 *
 * @module history
 * @submodule history-base
 */

/**
 * The HistoryBase class provides basic state management functionality backed by
 * an object. History state is shared globally among all instances and
 * subclass instances of HistoryBase.
 *
 * @class HistoryBase
 * @uses EventTarget
 * @constructor
 * @param {Object} config (optional) configuration object, which may contain
 *   zero or more of the following properties:
 *
 * <dl>
 *   <dt>initialState (Object)</dt>
 *   <dd>
 *     Initial state to set, as an object hash of key/value pairs. This will be
 *     merged into the current global state.
 *   </dd>
 * </dl>
 */

var Lang        = Y.Lang,
    Obj         = Y.Object,
    GlobalEnv   = YUI.namespace('Env.History'),

    EVT_CHANGE  = 'change',
    NAME        = 'historyBase',
    SRC_ADD     = 'add',
    SRC_REPLACE = 'replace',

HistoryBase = function () {
    this._init.apply(this, arguments);
};

Y.augment(HistoryBase, Y.EventTarget, null, null, {
    emitFacade : true,
    prefix     : 'history',
    preventable: false,
    queueable  : true
});

if (!GlobalEnv._state) {
    GlobalEnv._state = {};
}

// -- Public Static Properties -------------------------------------------------

/**
 * Name of this component.
 *
 * @property NAME
 * @type String
 * @static
 */
HistoryBase.NAME = NAME;

/**
 * Constant used to identify state changes originating from the
 * <code>add()</code> method.
 *
 * @property SRC_ADD
 * @type String
 * @static
 * @final
 */
HistoryBase.SRC_ADD = SRC_ADD;

/**
 * Constant used to identify state changes originating from the
 * <code>replace()</code> method.
 *
 * @property SRC_REPLACE
 * @type String
 * @static
 * @final
 */
HistoryBase.SRC_REPLACE = SRC_REPLACE;

Y.mix(HistoryBase.prototype, {
    // -- Initialization -------------------------------------------------------

    /**
     * Initializes this HistoryBase instance. This method is called by the
     * constructor.
     *
     * @method _init
     * @param {Object} config configuration object
     * @protected
     */
    _init: function (config) {
        var initialState = config && config.initialState;

        /**
         * Fired when the state changes. To be notified of all state changes
         * regardless of the History or YUI instance that generated them,
         * subscribe to this event on <code>Y.Global</code>. If you would rather
         * be notified only about changes generated by this specific History
         * instance, subscribe to this event on the instance.
         *
         * @event history:change
         * @param {EventFacade} e Event facade with the following additional
         *   properties:
         *
         * <dl>
         *   <dt>changed</dt>
         *   <dd>
         *     Object hash of state items that have been added or changed. The
         *     key is the item key, and the value is an object containing
         *     <code>newVal</code> and <code>prevVal</code> properties
         *     representing the values of the item both before and after the
         *     change. If the item was newly added, <code>prevVal</code> will be
         *     <code>undefined</code>.
         *   </dd>
         *
         *   <dt>newVal</dt>
         *   <dd>
         *     Object hash of key/value pairs of all state items after the
         *     change.
         *   </dd>
         *
         *   <dt>prevVal</dt>
         *   <dd>
         *     Object hash of key/value pairs of all state items before the
         *     change.
         *   </dd>
         *
         *   <dt>removed</dt>
         *   <dd>
         *     Object hash of key/value pairs of state items that have been
         *     removed. Values are the old values prior to removal.
         *   </dd>
         *
         *   <dt>src</dt>
         *   <dd>
         *     The source of the event. This can be used to selectively ignore
         *     events generated by certain sources.
         *   </dd>
         * </dl>
         */
        this.publish(EVT_CHANGE, {
            broadcast: 2,
            defaultFn: this._defChangeFn
        });

        // If initialState was provided and is a simple object, merge it into
        // the current state.
        if (Lang.isObject(initialState) && !Lang.isFunction(initialState) &&
                !Lang.isArray(initialState)) {
            this.add(Y.merge(GlobalEnv._state, initialState));
        }
    },

    // -- Public Methods -------------------------------------------------------

    /**
     * Adds a state entry with new values for the specified key or keys. Any key
     * with a <code>null</code> or <code>undefined</code> value will be removed
     * from the current state; all others will be merged into it.
     *
     * @method add
     * @param {Object|String} state|key object hash of key/value string pairs,
     *   or the name of a single key
     * @param {String|null} value (optional) if <i>state</i> is the name of a
     *   single key, <i>value</i> will become its new value
     * @chainable
     */
    add: function (state, value) {
        return this._change(SRC_ADD, state, value);
    },

    /**
     * Returns the current value of the state parameter specified by <i>key</i>,
     * or an object hash of key/value pairs for all current state parameters if
     * no key is specified.
     *
     * @method get
     * @param {String} key (optional) state parameter key
     * @return {Object|mixed} value of the specified state parameter, or an
     *   object hash of key/value pairs for all current state parameters
     */
    get: function (key) {
        var state = GlobalEnv._state;

        if (key) {
            return Obj.owns(state, key) ? state[key] : undefined;
        } else {
            return Y.mix({}, state, true); // Fast shallow clone.
        }
    },

    /**
     * Replaces the current state entry with new values for the specified
     * parameters, just as with <code>add()</code>, except that no change events
     * are generated.
     *
     * @method replace
     * @param {Object|String} state|key object hash of key/value string pairs,
     *   or the name of a single key
     * @param {String|null} value (optional) if <i>state</i> is the name of a
     *   single key, <i>value</i> will become its new value
     * @chainable
     */
    replace: function (state, value) {
        return this._change(SRC_REPLACE, state, value);
    },

    // -- Protected Methods ----------------------------------------------------

    /**
     * Changes the state. This method provides a common implementation shared by
     * add() and replace().
     *
     * @method _change
     * @param {String} src source of the change, for inclusion in event facades
     *   to facilitate filtering
     * @param {Object|String} state|key object hash of key/value string pairs,
     *   or the name of a single key
     * @param {String|null} value (optional) if <i>state</i> is the name of a
     *   single key, <i>value</i> will become its new value
     * @protected
     * @chainable
     */
    _change: function (src, state, value) {
        var key;

        if (Lang.isString(state)) {
            key        = state;
            state      = {};
            state[key] = value;
        }

        this._resolveChanges(src, Y.merge(GlobalEnv._state, state));
        return this;
    },

    /**
     * Called by _resolveChanges() when the state has changed. This method takes
     * care of actually firing the necessary events.
     *
     * @method _fireEvents
     * @param {String} src source of the changes, for inclusion in event facades
     *   to facilitate filtering
     * @param {Object} changes resolved changes
     * @protected
     */
    _fireEvents: function (src, changes) {
        // Fire the global change event.
        this.fire(EVT_CHANGE, {
            changed: changes.changed,
            newVal : changes.newState,
            prevVal: changes.prevState,
            removed: changes.removed,
            src    : src
        });

        // Fire change/remove events for individual items.
        Obj.each(changes.changed, function (value, key) {
            this._fireChangeEvent(src, key, value);
        }, this);

        Obj.each(changes.removed, function (value, key) {
            this._fireRemoveEvent(src, key, value);
        }, this);
    },

    /**
     * Fires a dynamic "[key]Change" event.
     *
     * @method _fireChangeEvent
     * @param {String} src source of the change, for inclusion in event facades
     *   to facilitate filtering
     * @param {String} key key of the item that was changed
     * @param {Object} value object hash containing <i>newVal</i> and
     *   <i>prevVal</i> properties for the changed item
     * @protected
     */
    _fireChangeEvent: function (src, key, value) {
        /**
         * <p>
         * Dynamic event fired when an individual history item is added or
         * changed. The name of this event depends on the name of the key that
         * changed. To listen to change events for a key named "foo", subscribe
         * to the <code>fooChange</code> event; for a key named "bar", subscribe
         * to <code>barChange</code>, etc.
         * </p>
         *
         * <p>
         * Key-specific events are only fired for instance-level changes; that
         * is, changes that were made via the same History instance on which the
         * event is subscribed. To be notified of changes made by other History
         * instances, subscribe to the global <code>history:change</code> event.
         * </p>
         *
         * @event [key]Change
         * @param {EventFacade} e Event facade with the following additional
         *   properties:
         *
         * <dl>
         *   <dt>newVal</dt>
         *   <dd>
         *     The new value of the item after the change.
         *   </dd>
         *
         *   <dt>prevVal</dt>
         *   <dd>
         *     The previous value of the item before the change, or
         *     <code>undefined</code> if the item was just added and has no
         *     previous value.
         *   </dd>
         *
         *   <dt>src</dt>
         *   <dd>
         *     The source of the event. This can be used to selectively ignore
         *     events generated by certain sources.
         *   </dd>
         * </dl>
         */
        this.fire(key + 'Change', {
            newVal : value.newVal,
            prevVal: value.prevVal,
            src    : src
        });
    },

    /**
     * Fires a dynamic "[key]Remove" event.
     *
     * @method _fireRemoveEvent
     * @param {String} src source of the change, for inclusion in event facades
     *   to facilitate filtering
     * @param {String} key key of the item that was removed
     * @param {mixed} value value of the item prior to its removal
     * @protected
     */
    _fireRemoveEvent: function (src, key, value) {
        /**
         * <p>
         * Dynamic event fired when an individual history item is removed. The
         * name of this event depends on the name of the key that was removed.
         * To listen to remove events for a key named "foo", subscribe to the
         * <code>fooRemove</code> event; for a key named "bar", subscribe to
         * <code>barRemove</code>, etc.
         * </p>
         *
         * <p>
         * Key-specific events are only fired for instance-level changes; that
         * is, changes that were made via the same History instance on which the
         * event is subscribed. To be notified of changes made by other History
         * instances, subscribe to the global <code>history:change</code> event.
         * </p>
         *
         * @event [key]Remove
         * @param {EventFacade} e Event facade with the following additional
         *   properties:
         *
         * <dl>
         *   <dt>prevVal</dt>
         *   <dd>
         *     The value of the item before it was removed.
         *   </dd>
         *
         *   <dt>src</dt>
         *   <dd>
         *     The source of the event. This can be used to selectively ignore
         *     events generated by certain sources.
         *   </dd>
         * </dl>
         */
        this.fire(key + 'Remove', {
            prevVal: value,
            src    : src
        });
    },

    /**
     * Resolves the changes (if any) between <i>newState</i> and the current
     * state and fires appropriate events if things have changed.
     *
     * @method _resolveChanges
     * @param {String} src source of the changes, for inclusion in event facades
     *   to facilitate filtering
     * @param {Object} newState object hash of key/value pairs representing the
     *   new state
     * @protected
     */
    _resolveChanges: function (src, newState) {
        var changed   = {},
            isChanged,
            prevState = GlobalEnv._state,
            removed   = {};

        newState = newState || {};

        // Figure out what was added or changed.
        Obj.each(newState, function (newVal, key) {
            var prevVal = prevState[key];

            if (newVal !== prevVal) {
                changed[key] = {
                    newVal : newVal,
                    prevVal: prevVal
                };

                isChanged = true;
            }
        }, this);

        // Figure out what was removed.
        // TODO: Could possibly improve performance slightly by not checking
        // keys that have been added/changed, since they obviously haven't been
        // removed. Need to profile to see if it's actually worth it.
        Obj.each(prevState, function (prevVal, key) {
            if (!Obj.owns(newState, key) || newState[key] === null) {
                delete newState[key];
                removed[key] = prevVal;
                isChanged = true;
            }
        }, this);

        if (isChanged) {
            this._fireEvents(src, {
                changed  : changed,
                newState : newState,
                prevState: prevState,
                removed  : removed
            });
        }
    },

    /**
     * Stores the specified state. Don't call this method directly; go through
     * _resolveChanges() to ensure that changes are resolved and all events are
     * fired properly.
     *
     * @method _storeState
     * @param {String} src source of the changes, for inclusion in event facades
     *   to facilitate filtering
     * @param {Object} newState new state to store
     * @protected
     */
    _storeState: function (src, newState) {
        // Note: the src param isn't used here, but it is used by subclasses.
        GlobalEnv._state = newState || {};
    },

    // -- Protected Event Handlers ---------------------------------------------

    /**
     * Default <code>history:change</code> event handler.
     *
     * @method _defChangeFn
     * @param {EventFacade} e state change event facade
     * @protected
     */
    _defChangeFn: function (e) {
        this._storeState(e.src, e.newVal);
    }
}, true);

Y.HistoryBase = HistoryBase;


}, '@VERSION@' ,{requires:['event-custom-complex']});
YUI.add('history-hash', function(Y) {

/**
 * The history-hash module adds the History class, which provides browser
 * history management functionality backed by <code>window.location.hash</code>.
 * This allows the browser's back and forward buttons to be used to navigate
 * between states.
 *
 * @module history
 * @submodule history-hash
 */

/**
 * The History class provides browser history management backed by
 * <code>window.location.hash</code>, as well as convenience methods for working
 * with the location hash and a synthetic <code>hashchange</code> event that
 * normalizes differences across browsers.
 *
 * @class History
 * @extends HistoryBase
 * @constructor
 * @param {Object} config (optional) Configuration object. See the HistoryBase
 *   documentation for details.
 */

var HistoryBase    = Y.HistoryBase,
    Lang           = Y.Lang,
    Obj            = Y.Object,
    GlobalEnv      = YUI.namespace('Env.History'),

    SRC_HASH       = 'hash',

    config         = Y.config,
    doc            = config.doc,
    docMode        = doc.documentMode,
    hashNotifiers,
    oldHash,
    oldUrl,
    win            = config.win,
    location       = win.location,

    // IE8 supports the hashchange event, but only in IE8 Standards
    // Mode. However, IE8 in IE7 compatibility mode still defines the
    // event but never fires it, so we can't just sniff for the event. We also
    // can't just sniff for IE8, since other browsers have begun to support this
    // event as well.
    nativeHashChange = !Lang.isUndefined(win.onhashchange) &&
            (Lang.isUndefined(docMode) || docMode > 7),

History = function () {
    History.superclass.constructor.apply(this, arguments);
};

Y.extend(History, HistoryBase, {
    // -- Initialization -------------------------------------------------------
    _init: function (config) {
        // Use the bookmarked state as the initialState if no initialState was
        // specified.
        config = config || {};
        config.initialState = config.initialState || History.parseHash();

        // Subscribe to the synthetic hashchange event (defined below) to handle
        // changes.
        Y.after('hashchange', Y.bind(this._afterHashChange, this), win);

        History.superclass._init.call(this, config);
    },

    // -- Protected Methods ----------------------------------------------------
    _storeState: function (src, newState) {
        var newHash = History.createHash(newState);

        History.superclass._storeState.apply(this, arguments);

        // Update the location hash with the changes, but only if the new hash
        // actually differs from the current hash (this avoids creating multiple
        // history entries for a single state).
        if (History.getHash() !== newHash) {
            History[src === HistoryBase.SRC_REPLACE ? 'replaceHash' : 'setHash'](newHash);
        }
    },

    // -- Protected Event Handlers ---------------------------------------------

    /**
     * Handler for hashchange events.
     *
     * @method _afterHashChange
     * @protected
     */
    _afterHashChange: function (e) {
        this._resolveChanges(SRC_HASH, History.parseHash(e.newHash));
    }
}, {
    // -- Public Static Properties ---------------------------------------------
    NAME: 'history',

    /**
     * Constant used to identify state changes originating from
     * <code>hashchange</code> events.
     *
     * @property SRC_HASH
     * @type String
     * @static
     * @final
     */
    SRC_HASH: SRC_HASH,

    /**
     * <p>
     * Prefix to prepend when setting the hash fragment. For example, if the
     * prefix is <code>!</code> and the hash fragment is set to
     * <code>#foo=bar&baz=quux</code>, the final hash fragment in the URL will
     * become <code>#!foo=bar&baz=quux</code>. This can be used to help make an
     * Ajax application crawlable in accordance with Google's guidelines at
     * <a href="http://code.google.com/web/ajaxcrawling/">http://code.google.com/web/ajaxcrawling/</a>.
     * </p>
     *
     * <p>
     * Note that this prefix applies to all History instances. It's not possible
     * for individual instances to use their own prefixes since they all operate
     * on the same URL.
     * </p>
     *
     * @property hashPrefix
     * @type String
     * @default ''
     * @static
     */
    hashPrefix: '',

    /**
     * Whether or not this browser supports the <code>window.onhashchange</code>
     * event natively. Note that even if this is <code>true</code>, you may
     * still want to use History's synthetic <code>hashchange</code> event since
     * it normalizes implementation differences and fixes spec violations across
     * various browsers.
     *
     * @property nativeHashChange
     * @type Boolean
     * @static
     */
    nativeHashChange: nativeHashChange,

    // -- Protected Static Properties ------------------------------------------

    /**
     * Regular expression used to parse location hash/query strings.
     *
     * @property _REGEX_HASH
     * @type RegExp
     * @protected
     * @static
     * @final
     */
    _REGEX_HASH: /([^\?#&]+)=([^&]+)/g,

    // -- Public Static Methods ------------------------------------------------

    /**
     * Creates a location hash string from the specified object of key/value
     * pairs.
     *
     * @method createHash
     * @param {Object} params object of key/value parameter pairs
     * @return {String} location hash string
     * @static
     */
    createHash: function (params) {
        var encode = History.encode,
            hash   = [];

        Obj.each(params, function (value, key) {
            if (Lang.isValue(value)) {
                hash.push(encode(key) + '=' + encode(value));
            }
        });

        return hash.join('&');
    },

    /**
     * Wrapper around <code>decodeURIComponent()</code> that also converts +
     * chars into spaces.
     *
     * @method decode
     * @param {String} string string to decode
     * @return {String} decoded string
     * @static
     */
    decode: function (string) {
        return decodeURIComponent(string.replace(/\+/g, ' '));
    },

    /**
     * Wrapper around <code>encodeURIComponent()</code> that converts spaces to
     * + chars.
     *
     * @method encode
     * @param {String} string string to encode
     * @return {String} encoded string
     * @static
     */
    encode: function (string) {
        return encodeURIComponent(string).replace(/%20/g, '+');
    },

    /**
     * Gets the raw (not decoded) current location hash, minus the preceding '#'
     * character and the hashPrefix (if one is set).
     *
     * @method getHash
     * @return {String} current location hash
     * @static
     */
    getHash: (Y.UA.gecko ? function () {
        // Gecko's window.location.hash returns a decoded string and we want all
        // encoding untouched, so we need to get the hash value from
        // window.location.href instead. We have to use UA sniffing rather than
        // feature detection, since the only way to detect this would be to
        // actually change the hash.
        var matches = /#(.*)$/.exec(location.href),
            hash    = matches && matches[1] || '',
            prefix  = History.hashPrefix;

        return prefix && hash.indexOf(prefix) === 0 ?
                    hash.replace(prefix, '') : hash;
    } : function () {
        var hash   = location.hash.substr(1),
            prefix = History.hashPrefix;

        // Slight code duplication here, but execution speed is of the essence
        // since getHash() is called every 20ms or so to poll for changes in
        // browsers that don't support native onhashchange. An additional
        // function call would add unnecessary overhead.
        return prefix && hash.indexOf(prefix) === 0 ?
                    hash.replace(prefix, '') : hash;
    }),

    /**
     * Gets the current bookmarkable URL.
     *
     * @method getUrl
     * @return {String} current bookmarkable URL
     * @static
     */
    getUrl: function () {
        return location.href;
    },

    /**
     * Parses a location hash string into an object of key/value parameter
     * pairs. If <i>hash</i> is not specified, the current location hash will
     * be used.
     *
     * @method parseHash
     * @param {String} hash (optional) location hash string
     * @return {Object} object of parsed key/value parameter pairs
     * @static
     */
    parseHash: function (hash) {
        var decode = History.decode,
            i,
            len,
            matches,
            param,
            params = {},
            prefix = History.hashPrefix,
            prefixIndex;

        hash = Lang.isValue(hash) ? hash : History.getHash();

        if (prefix) {
            prefixIndex = hash.indexOf(prefix);

            if (prefixIndex === 0 || (prefixIndex === 1 && hash.charAt(0) === '#')) {
                hash = hash.replace(prefix, '');
            }
        }

        matches = hash.match(History._REGEX_HASH) || [];

        for (i = 0, len = matches.length; i < len; ++i) {
            param = matches[i].split('=');
            params[decode(param[0])] = decode(param[1]);
        }

        return params;
    },

    /**
     * Replaces the browser's current location hash with the specified hash
     * and removes all forward navigation states, without creating a new browser
     * history entry. Automatically prepends the <code>hashPrefix</code> if one
     * is set.
     *
     * @method replaceHash
     * @param {String} hash new location hash
     * @static
     */
    replaceHash: function (hash) {
        if (hash.charAt(0) === '#') {
            hash = hash.substr(1);
        }

        location.replace('#' + (History.hashPrefix || '') + hash);
    },

    /**
     * Sets the browser's location hash to the specified string. Automatically
     * prepends the <code>hashPrefix</code> if one is set.
     *
     * @method setHash
     * @param {String} hash new location hash
     * @static
     */
    setHash: function (hash) {
        if (hash.charAt(0) === '#') {
            hash = hash.substr(1);
        }

        location.hash = (History.hashPrefix || '') + hash;
    }
});

// -- Synthetic hashchange Event -----------------------------------------------
hashNotifiers = YUI.namespace('Env.History._hashNotifiers');

// TODO: YUIDoc currently doesn't provide a good way to document synthetic DOM
// events. For now, we're just documenting the hashchange event on the YUI
// object, which is about the best we can do until enhancements are made to
// YUIDoc.

/**
 * <p>
 * Synthetic <code>window.onhashchange</code> event that normalizes differences
 * across browsers and provides support for browsers that don't natively support
 * <code>onhashchange</code>.
 * </p>
 *
 * <p>
 * This event is provided by the <code>history-hash</code> module.
 * </p>
 *
 * <p>
 * <strong>Usage example:</strong>
 * </p>
 *
 * <code><pre>
 * YUI().use('history-hash', function (Y) {
 * &nbsp;&nbsp;Y.on('hashchange', function (e) {
 * &nbsp;&nbsp;&nbsp;&nbsp;// Handle hashchange events on the current window.
 * &nbsp;&nbsp;}, Y.config.win);
 * });
 * </pre></code>
 *
 * @event hashchange
 * @param {EventFacade} e Event facade with the following additional
 *   properties:
 *
 * <dl>
 *   <dt>oldHash</dt>
 *   <dd>
 *     Previous hash fragment value before the change.
 *   </dd>
 *
 *   <dt>oldUrl</dt>
 *   <dd>
 *     Previous URL (including the hash fragment) before the change.
 *   </dd>
 *
 *   <dt>newHash</dt>
 *   <dd>
 *     New hash fragment value after the change.
 *   </dd>
 *
 *   <dt>newUrl</dt>
 *   <dd>
 *     New URL (including the hash fragment) after the change.
 *   </dd>
 * </dl>
 * @for YUI
 */
Y.Event.define('hashchange', {
    on: function (node, subscriber, notifier) {
        // Ignore this subscriber if the node is anything other than the
        // window or document body, since those are the only elements that
        // should support the hashchange event. Note that the body could also be
        // a frameset, but that's okay since framesets support hashchange too.
        if ((node.compareTo(win) || node.compareTo(doc.body)) &&
                !Obj.owns(hashNotifiers, notifier.key)) {

            hashNotifiers[notifier.key] = notifier;
        }
    },

    detach: function (node, subscriber, notifier) {
        // TODO: Is it safe to use hasSubs()? It's not marked private/protected,
        // but also not documented. Also, subscriber counts don't seem to be
        // updated after detach().
        if (!notifier.hasSubs()) {
            delete hashNotifiers[notifier.key];
        }
    }
});

oldHash = History.getHash();
oldUrl  = History.getUrl();

if (nativeHashChange) {
    // Wrap the browser's native hashchange event.
    Y.Event.attach('hashchange', function (e) {
        var newHash = History.getHash(),
            newUrl  = History.getUrl();

        Obj.each(hashNotifiers, function (notifier) {
            // TODO: would there be any benefit to making this an overridable
            // protected method?
            notifier.fire({
                oldHash: oldHash,
                oldUrl : oldUrl,
                newHash: newHash,
                newUrl : newUrl
            });
        });

        oldHash = newHash;
        oldUrl  = newUrl;
    }, win);
} else {
    // Begin polling for location hash changes if there's not already a global
    // poll running.
    if (!GlobalEnv._hashPoll) {
        if (Y.UA.webkit && !Y.UA.chrome) {
            // Attach a noop unload handler to disable Safari's back/forward
            // cache. This works around a nasty Safari bug when the back button
            // is used to return from a page on another domain, but results in
            // slightly worse performance. This bug is not present in Chrome.
            //
            // Current as of Safari 4.0.5 (6531.22.7).
            // See: https://bugs.webkit.org/show_bug.cgi?id=34679
            Y.on('unload', function () {}, win);
        }

        GlobalEnv._hashPoll = Y.later(config.pollInterval || 50, null, function () {
            var newHash = History.getHash(),
                newUrl;

            if (oldHash !== newHash) {
                newUrl = History.getUrl();

                Obj.each(hashNotifiers, function (notifier) {
                    notifier.fire({
                        oldHash: oldHash,
                        oldUrl : oldUrl,
                        newHash: newHash,
                        newUrl : newUrl
                    });
                });

                oldHash = newHash;
                oldUrl  = newUrl;
            }
        }, null, true);
    }
}

Y.History = History;


}, '@VERSION@' ,{requires:['event-synthetic', 'history-base', 'yui-later']});
YUI.add('history-hash-ie', function(Y) {

/**
 * The history-hash-ie module improves IE6/7 support in history-hash by using a
 * hidden iframe to create entries in IE's browser history. This module is only
 * needed if IE6/7 support is necessary; it's not needed for any other browser.
 *
 * @module history
 * @submodule history-hash-ie
 */

var Do        = Y.Do,
    GlobalEnv = YUI.namespace('Env.History'),
    History   = Y.History,
    iframe    = GlobalEnv._iframe,
    win       = Y.config.win,
    location  = win.location;

if (Y.UA.ie && Y.UA.ie < 8) {
    History.getHash = function () {
        return iframe ? iframe.contentWindow.location.hash.substr(1) : '';
    };

    History.getUrl = function () {
        var hash = History.getHash();

        if (hash && hash !== location.hash.substr(1)) {
            return location.href.replace(/#.*$/, '') + '#' + hash;
        } else {
            return location.href;
        }
    };

    /**
     * Updates the history iframe with the specified hash.
     *
     * @method _updateIframe
     * @param {String} hash location hash
     * @param {Boolean} replace (optional) if <code>true</code>, the current
     *   history state will be replaced without adding a new history entry
     * @protected
     * @static
     * @for History
     */
    History._updateIframe = function (hash, replace) {
        var iframeDoc      = iframe.contentWindow.document,
            iframeLocation = iframeDoc.location;

        Y.log('updating history iframe: ' + hash, 'info', 'history');

        iframeDoc.open().close();

        if (replace) {
            iframeLocation.replace(hash.charAt(0) === '#' ? hash : '#' + hash);
        } else {
            iframeLocation.hash = hash;
        }
    };

    Do.after(History._updateIframe, History, 'replaceHash', History, true);
    Do.after(History._updateIframe, History, 'setHash');

    if (!iframe) {
        // Create an iframe to store history state.
        Y.log('creating dynamic history iframe', 'info', 'history');

        iframe = GlobalEnv._iframe = Y.Node.getDOMNode(Y.Node.create(
            '<iframe src="javascript:0" style="display:none"/>'
        ));

        // Don't add the iframe to the DOM until the DOM is ready, lest we
        // frighten IE.
        Y.on('domready', function () {
            // The iframe is appended to the documentElement rather than the
            // body. Keeping it outside the body prevents scrolling on the
            // initial page load (hat tip to Ben Alman and jQuery BBQ for this
            // technique).
            Y.config.doc.documentElement.appendChild(iframe);

            // Update the iframe with the initial location hash, if any. This
            // will create an initial history entry that the user can return to
            // after the state has changed.
            History._updateIframe(location.hash.substr(1));
        });

        // Listen for hashchange events and keep the parent window's location
        // hash in sync with the hash stored in the iframe.
        Y.on('hashchange', function (e) {
            if (location.hash.substr(1) !== e.newHash) {
                Y.log('updating parent location hash to match iframe location hash', 'info', 'history');
                location.hash = e.newHash;
            }
        }, win);
    }
}


}, '@VERSION@' ,{requires:['history-base', 'history-hash', 'node-base']});


YUI.add('history', function(Y){}, '@VERSION@' ,{use:['history-base', 'history-hash', 'history-hash-ie']});

