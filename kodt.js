
(function ( factory ) {
    "use strict";

    if ("function" === typeof define && define.amd) {
        define(["knockout", "jquery", "datatables"], factory);
    } else if ("undefined" !== typeof module) {
        module.exports = factory(
            require("knockout"),
            require("jquery"),
            require("datatables")
        );
    } else {
        if (!(window.ko && window.$)) {
            throw new Error("grid: not supported");
        }

        factory(window.ko, window.$);
    }

})(function ( ko, $ ) {
    "use strict";

    /** @namespace ko */

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
        prefix = prefix || ""; // -jshint won"t allow expression

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

    /**
     * @namespace ko.grid
     * @memberof ko
     */
    ko.grid = {
        /**
         * Ascending order for sorting
         * @static
         * @memberof ko.grid
         * @member SORT_ASC
         * @default ASC
         */
        SORT_ASC: "ASC"
        /**
         * Descending order for sorting
         * @static
         * @memberof ko.grid
         * @member SORT_DSC
         * @default DEC
         */
    ,   SORT_DSC: "DEC"
    ,   TYPE_CONTROL: "control"
    ,   TYPE_TEXT: "text"
    ,   TYPE_STRING: "string"
    };

    // ========== TEMPLATES ==========

    /**
     * @namespace ko.grid.templates
     * @memberof ko.grid
     */
    ko.grid.templates = {  };

    /**
     * control template generator
     * @static
     * @memberof ko.grid.templates
     * @function control
     * @return {String} control template
     */
    ko.grid.templates[ko.grid.TYPE_CONTROL] = function ( ) {
        return "";
    };

    /**
     * text template generator - no input, display value only
     * @static
     * @memberof ko.grid.templates
     * @function text
     * @return {String} text template
     */
    ko.grid.templates[ko.grid.TYPE_TEXT] = function ( ) {
        return make_element("span", make_binding({text: this.value}));
    };

    /**
     * string template generator - input as string type
     * @static
     * @memberof ko.grid.templates
     * @function string
     * @return {String} string template
     */
    ko.grid.templates[ko.grid.TYPE_STRING] = function ( ) {
        return make_element("input", make_binding({value: this.value}), false);
    };

    // ========== DATA MODELS ==========

    /**
     * model for grid data
     * @class DataModel
     * @memberof ko.grid
     * @param {Object} options overridable settings
     * @param {Array<Object|Array>} [options.rows=[ ]] initial dataset
     * @param {Number} [options.page=1] current page location
     * @param {Number} [options.pageSize=20] count of items per page
     * @param {String} [options.sortField=null] field to sort by
     * @param {String} [options.sortOrder={@link ko.grid.SORT_ASC}]
     *  order to sort by
     * @param {Function} [options.onrequest=null] data request callback
     * @param {Function} [options.onaddrow=null] row normalization callback
     * @param {Function} [options.onaddcell=null] cell normalization callback
     * @param {Function} [options.onchange=null] data change callback
     */
    ko.grid.DataModel = function ( options ) {
        var that;

        if (!this) {
            return new ko.grid.DataModel(options);
        }

        that = this;

        $.extend(this, {
            rows: [  ]
        ,   page: 1
        ,   pageSize: 20
        ,   sortField: null
        ,   sortOrder: ko.grid.SORT_ASC
        ,   onrequest: null
        ,   onadd: null
        ,   onchange: null
        }, options);

        this.mapper = function ( row ) {
            var obj, index, convert;

            obj = row.data();

            convert = function ( val, index ) {
                var selector = obj instanceof Array ? index : index + ":name"
                ,   column = row.column(selector)
                ,   cell = row.cell(row.node(), selector)
                ;

                if (!ko.isObservable(val)) {
                    val = ko.observable(val);
                }

                obj[index] = val;

                if ("function" === typeof that.onchange) {
                    val.subscribe(function ( ) {
                        that.onchange({
                            row: row,
                            cell: cell,
                            column: column
                        });
                    });
                }

                if ("function" === typeof that.onaddcell) {
                    that.onaddcell.call(that, cell);
                }
            };

            for (index in obj) {
                convert(obj[index], index);
            }

            if ("function" === typeof that.onaddrow) {
                that.onaddrow.call(that, row);
            }

            return obj;
        };

        if (!ko.isObservableArray(that.rows)) {
            // TODO: preserve subscriptions
            that.rows = ko.observableArray(ko.unwrap(this.rows));
        }

        if ("function" === typeof that.onrequest) {
            that.refresh = function ( ) {
                that.onrequest(this, function ( error, rows ) {
                    // TODO: error handler
                    if (error) { return; }
                    if (rows) {
                        that.rows(ko.unwrap(rows));
                    }
                });
            };
        } else {
            that.refresh = function ( ) { };
        }

        [   "page"
        ,   "pageSize"
        ,   "sortField"
        ,   "sortOrder"
        ].forEach(function ( name ) {
            if (!ko.isObservable(that[name])) {
                that[name] = ko.observable(that[name]);
            }

            if ("function" === typeof that.onrequest) {
                that[name].subscribe(that.onrefresh);
            }
        });
    };

    // ========== COLUMN MODELS ==========

    /**
     * base model for grid column
     * @class ColumnModel
     * @memberof ko.grid
     * @param {String|Object} [options]
     *  when object: overridable settings;
     *  when string: fills title
     * @param {String} [options.name] identification value
     * @param {String} [options.title] display name
     * @param {String} [options.type] editor type information
     *  (useful for comboboxes, etc)
     * @param {String} [options.template] cell rendering template
     * @param {Boolean} [options.control] is control column
     * @param {Object} [options.object] is object column model
     */
    ko.grid.ColumnModel = function ( options ) {

        if (!this) {
            return new ko.grid.ColumnModel(options);
        }

        if ("string" === typeof options) {
            this.title = options;
        } else if (options instanceof Object) {
            $.extend(this, options);
        }

        if (this.type === void 0) {
            this.type = ko.grid.TYPE_TEXT;
        }

        if (this.name === void 0) {
            this.name = pid_for_column();
        }

        if (this.title === void 0) {
            this.title = this.name;
        }

        if (this.control) {
            this.title = "";
            this.className = (this.className || "") + " control";
            this.orderable = false;
            this.defaultContent = "";
            this.type = ko.grid.TYPE_CONTROL;
        }

        if (this.object && this.data === void 0) {
            this.data = this.name;
        }

        if (this.template === void 0) {
            this.template = ko.grid.templates[this.type] ||
                "<!-- ko template:'" + this.type + "' --><!-- /ko -->";
        }

        if (/^[$A-Z_][$0-9A-Z_]*$/i.test(this.template)) {
            this.template =
                "<!-- ko template:'" + this.template + "' --><!-- /ko -->";
        }
    };


    // ========== SELECTION MODELS ==========


    // ========== KO BINDING ==========

    /**
     * type detection, override to provide custom detection
     * @static
     * @memberof ko.grid
     * @function detect_type
     * @param {Any} item item to detect type of
     * @return {String} type of passed item
     * @example
     *      var old_detect = ko.grid.detect_type;
     *      ko.grid.detect_type = function ( item ) {
     *          if ("MyClass" === item.constructor.name) {
     *              return "mytype";
     *          }
     *          return old_detect(item);
     *      };
     */
    ko.grid.detect_type = function ( item ) {
        switch (item.constructor.name) {
            case "String":
                return ko.grid.TYPE_STRING;
            default:
                return ko.grid.TYPE_TEXT;
        }
    };

    /**
     * generator for column templates
     * @private
     * @static
     * @memberof ko.grid
     * @function create_column_template
     * @param {Object} settings binding handler settings
     */
    ko.grid.create_column_template = function ( settings ) {
        var data, index, title;
        settings.columnModels = [ ];

        if (!(data = settings.dataModel.rows()[0])) {
            throw new Error("grid: cannot generate rows with no data");
        }

        title = function ( name ) {
            return name
                .replace(/_/g, " ")
                .replace(/([a-z])([A-Z])/g, "$1 $2");
        };

        for (index in data) {
            settings.columnModels.push(new ko.grid.ColumnModel({
                name: index
            ,   title: ("number" === typeof index) ? index : title(index)
            ,   type: ko.grid.detect_type(ko.unwrap(data[index]))
            ,   object: !(data instanceof Array)
            }));
        }
    };

    /**
     * factory for row templates
     * @private
     * @static
     * @memberof ko.grid
     * @function create_row_template
     * @param {Object} settings binding handler settings
     * @return {Element} row template
     */
    ko.grid.create_row_template = function ( settings ) {
        var row_template = $("<tr>")
        ,   template
        ,   index
        ,   model;

        if (!settings.columnModels) {
            ko.grid.create_column_template(settings);
        }

        for (index in settings.columnModels) {
            model = settings.columnModels[index];
            if (!(model instanceof ko.grid.ColumnModel)) {
                settings.columnModels[index] = model =
                    new ko.grid.ColumnModel(model);
            }
            // add convenience members
            model.index = index;
            model.value = (model.object) ? model.name : "$data[" + index + "]";
            // auto detect settings
            if (model.searchable) {
                settings._searchable = true;
            }
            // form cell and unwrap template if necessary
            template = $("<td class=\"" +
                model.type + " " +
                model.name + " " +
                (model.className || "") + "\">");
            model = (model.template instanceof Function)
                ? model.template() : model.template;

            // add model to template
            template.append(model);
            // add template to row
            row_template.append(template);
        }

        // unwrap from jquery
        row_template = row_template[0];

        // register to anonymous template
        new ko.templateSources.anonymousTemplate(row_template)
            .nodes(row_template);
        // TODO: fix memory leak

        return row_template;
    };

    /**
     * @namespace ko.bindingHandlers
     * @memberof ko
     */

    /**
     * @namespace grid
     * @memberof ko.bindingHandlers
     */
    ko.bindingHandlers.grid = {
        /**
         * called to initialize grid binding within knockout
         * @memberof ko.bindingHandlers.grid
         * @function init
         * @param {Element} element node holding binding
         * @param {Function} valueAccessor accesses bindings
         * @param {Function} allBindingsAccessor accesses all bindings
         * @param {Object} viewModel data associated to binding
         * @param {Object} bindingContext context associated to binding
         */
        init: function (
                element
            ,   valueAccessor
            // jshint unused: false
            // reason; need last perameter but not these
            ,   allBindingsAccessor
            ,   viewModel
            // jshint unused: true
            ,   bindingContext
        ) {
            var settings, options, table, api;

            settings = valueAccessor() || { };
            settings.options = settings.options || { };
            options = settings.options;

            // settings normalization
            if (!(settings.dataModel instanceof ko.grid.DataModel)) {
                settings.dataModel = new ko.grid.DataModel(settings.dataModel);
            }

            settings._row_template = ko.grid.create_row_template(settings);

            // options construction
            options.columns = settings.columnModels;
            options.data = ko.unwrap(settings.dataModel.rows);
            options.serverSide = settings.dataModel.request instanceof Function;
            if (!options.dom) {
                options.dom = (options.allowColumnReorder ? "R" : "") +
                    "ti" + (options.scrollY ? "S" : "p") +
                    (settings._searchable ? "f" : "");
            }

            if (options.serverSide) {
                options.serverData = function ( source, data ) {
                    // TODO: tie into data model
                    console.log(source, data);
                };
            }

            settings._createdRow = options.createdRow;
            options.createdRow = function ( row, src, index ) {
                var $row, _row, ctx;

                $row = $(row);
                _row = this.api().row($row);
                ctx = settings.dataModel.mapper(_row);

                ctx = bindingContext.createChildContext(ctx, settings.as);
                ctx.$row = _row;

                ko.renderTemplate(settings._row_template,
                    ctx, { }, row, "replaceChildren");

                if (settings._createdRow instanceof Function) {
                    settings._createdRow.call(this, row, src, index);
                }

                if (settings.oncreaterow instanceof Function) {
                    settings.oncreaterow.call(this, _row);
                }

                if (settings.selectionModels) {
                    settings.selectionModels.forEach(function ( model ) {
                        model.onregister(_row);
                    });
                }
            };

            table = $(element).dataTable(options);
            api = table.api();

            settings.dataModel.rows.subscribe(function ( items ) {
                var nodes, count;

                nodes = api.rows().nodes();

                // unregister
                if (nodes.length) {
                    ko.utils.arrayForEach(nodes, function ( node ) {
                        ko.cleanNode(node);
                    });
                }

                count = settings.dataModel.rows.length;

                table._fnAjaxUpdateDraw({
                    aaData: items,
                    iTotalRecords: count,
                    iTotalDisplayRecords: count
                });
            });

            if (settings.api instanceof Function) {
                settings.api(api, table);
            }
        }
    };
});

