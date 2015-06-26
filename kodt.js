
(function ( factory ) {
    "use strict";

    var old;

    if ("function" === typeof define && define.amd) {
        define(["ko", "jquery"], factory);
    } else if ("undefined" !== typeof module) {
        module.exports = factory(
            require("knockout"),
            require("jquery")
        );
    } else {
        if (!(window.ko && window.$)) {
            throw new Error("grid: not supported");
        }

        factory(window.ko, window.$);

    }

})(function ( ko, $ ) {
    "use strict";

    var pid_generator
    ,   pid_for_column
    ,   make_element
    ,   make_binding
    ;

    /**
     * creates a pid generator with the given prefix
     * @private
     * @param {String} prefix value to return before the pid
     * @return {String} prefix followed by next pid
     */
    pid_generator = function ( prefix ) {
        var id = 0;
        prefix = prefix || ""; // -jshint won't allow expression

        return function ( ) {
            return prefix + id++;
        };
    };

    /**
     * creates a string form of an element
     * @private
     * @param {String} name what element to create
     * @param {Object} [attrs] attributes to place on the element
     * @param {String|Boolean} [content] what to place in the item
     *  if content is false, item will self close
     * @return {String} constructed element
     */
    make_element = function ( name, attrs, content ) {
        var attr, elem = "<" + name;
        for (attr in attrs) {
            elem += " " + attr + "=\"" + attrs[attr] + "\"";
        }
        if (content === false) {
            elem += "/>";
        } else {
            elem += ">" + content + "</" + name + ">";
        }
        return elem;
    };

    /**
     * formats json into ko bindings
     * @private
     * @param {Object} attrs attributes to bind
     * @return {Object} binding as string in object with data-bind
     */
    make_binding = function ( attrs ) {
        var attr, elem, elems = [ ];

        for (attr in attrs) {
            elem = attr + ":";
            if ("object" === typeof attrs[attr]) {
                elem += "{" + make_binding(attrs[attr]) + "}";
            } else {
                elem += attrs[attr];
            }
            elems.push(elem);
        }
        return {"data-bind": elems.join(",")};
    };

    /**
     * generator for column pids
     * @private
     * @return  {String} pid in the form column_{pid}
     */
    pid_for_column = pid_generator("column_");

    // polyfill
    if (!ko.isObservableArray) {
        ko.isObservableArray = function ( o ) {
            return ko.isObservable(o) && o.push;
        };
    }

});

