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

   // polyfill
   if (!ko.isObservableArray) {
       ko.isObservableArray = function ( o ) {
           return ko.isObservable(o) && "function" === typeof o.push;
       };
   }

   // ========== HELPERS ==========

   var pid_generator
   ,   make_element
   ,   make_binding
   ,   unwrap_template
   ,   deep_compare
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
    * generator for column pids
    * @private
    * @return  {String} pid in the form column_{pid}
    */
   pid_generator.column = pid_generator("column_");

   /**
    * generator for child pids
    * @private
    * @return  {String} pid in the form child_{pid}
    */
   pid_generator.child = pid_generator("child_");

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
           elem += ">" + (content || "") + "</" + name + ">";
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
    * unwraps template and changes to tags if identifier
    * @private
    * @this {Object} something with a template property
    * @param {String} [property] name of property to use
    */
    unwrap_template = function ( property ) {
        if (property === void 0) {
            property = "template";
        }
        if (this[property] instanceof Function) {
            this[property] = this[property]();
        }
        if (/^[$A-Z_][$0-9A-Z_]*$/i.test(this[property])) {
            this[property] =
                "<!-- ko template:'" + this[property] + "' --><!-- /ko -->";
        }
    };
    
    deep_compare = function( a, b )
    {
        if(typeof(a) !== typeof(b)) {
            return false;
        }
        
        if( a === null && b === null )
            return true; 
        
        if( a === null || b === null )
            return false;
       
            
        for( var i in a )
        {
            if( !b[i] )
            {
                return false;
            }
            if( typeof(b[i]) === 'object' )
            {
                if( !deep_compare( b[i],a[i] ) )
                    return false;
            }
            else if( b[i] !== a[i] )
                return false;
        }
        for( var i in b )
        {
            if( !a[i] )
            {
                return false;
            }
            if( typeof(a[i]) === 'object' )
            {
                if( !deep_compare( b[i],a[i] ) )
                    return false;
            }
            else if( b[i] !== a[i] )
                return false;
        }
        
        return true;
    }
   /**
    * @namespace ko.grid
    * @memberof ko
    */
   ko.grid = {
       /**
        * ascending order for sorting
        * @static
        * @memberof ko.grid
        * @member SORT_ASC
        * @default asc
        */
       SORT_ASC: "asc"
       /**
        * descending order for sorting
        * @static
        * @memberof ko.grid
        * @member SORT_DSC
        * @default desc
        */
   ,   SORT_DSC: "desc"
       /**
        * control column type
        * @static
        * @memberof ko.grid
        * @member TYPE_CONTROL
        * @default control
        */
   ,   TYPE_CONTROL: "control"
       /**
        * text column type
        * @static
        * @memberof ko.grid
        * @member TYPE_TEXT
        * @default text
        */
   ,   TYPE_TEXT: "text"
       /**
        * string column type
        * @static
        * @memberof ko.grid
        * @member TYPE_STRING
        * @default string
        */
   ,   TYPE_STRING: "string"
       /**
        * checkbox column type
        * @static
        * @memberof ko.grid
        * @member TYPE_CHECKBOX
        * @default checkbox
        */ // TODO: call this BOOLEAN
   ,   TYPE_CHECKBOX: "checkbox"
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
       return make_element("span", make_binding({text: "value"}));
   };

   /**
    * string template generator - input as string type
    * @static
    * @memberof ko.grid.templates
    * @function string
    * @return {String} string template
    */
   ko.grid.templates[ko.grid.TYPE_STRING] = function ( ) {
       var attrs = make_binding({value: "value"});
       attrs.type = "text";
       return make_element("input", attrs, false);
   };

   /**
    * checkbox template generator - input as checkbox type
    * @static
    * @memberof ko.grid.templates
    * @function checkbox
    * @return {String} string template
    */
   ko.grid.templates[ko.grid.TYPE_CHECKBOX] = function ( ) {
       var attrs = make_binding({value: "value", checked: "value"});
       attrs.type = "checkbox";
       return make_element("input", attrs, false);
   };

   // ========== DATA MODELS ==========

   /**
    * model for grid data
    * @class DataModel
    * @memberof ko.grid
    * @param {Object} options overridable settings
    * @param {Array<Object|Array>} [options.rows=[]] initial dataset
    * @param {Number}  [options.page=1] current page location
    * @param {Number}  [options.pageSize=20] count of items per page
    * @param {Boolean} [options.usejson=true] treat rows as json objects
    *  alternative will expect arrays
    * @param {String}  [options.sortField=null] field to sort by
    * @param {String}  [options.sortOrder={@link ko.grid.SORT_ASC}]
    *  order to sort by
    * @param {Function} [options.onrequest=null] data request callback
    * @param {Function} [options.onaddrow=null] row normalization callback
    * @param {Function} [options.onaddcell=null] cell normalization callback
    * @param {Function} [options.onchange=null] data change callback
    * @param {Function} [options.onbefore=null] data before change callback
    */
   ko.grid.DataModel = function ( options ) {
       var that;

       if (!this) {
           return new ko.grid.DataModel(options);
       }

       that = this;

       $.extend(this, {
           rows: [  ]

           // TODO: implement column based searching
       ,   start: 0
       ,   count: 30
       ,   search: ""
       ,   order: null
       ,   initialOrder: null
       ,   filters: []

       ,   usejson: true
       ,   onrequest: null
       ,   onaddrow: null
       ,   onaddcell: null
       ,   onchange: null
       ,   onbefore: null
       ,   serverTotal: null
       }, options);

       this.mapper = function ( row ) {
           var obj, index, convert
           ,   make_api = function ( selector ) {
                   return {
                       row: row
                   ,   column: row.column(selector)
                   ,   cell: row.cell(row.node(), selector)
                   };
               }
           ;

           obj = row.data();

           convert = function ( val, index ) {
               var selector = obj instanceof Array ? index : index + ":name"
               ,   api;

               if (!ko.isObservable(val)) {
                   val = ko.observable(val);
               }

               obj[index] = val;

               if ("function" === typeof that.onchange) {
                   val.subscribe(function ( ) {
                       that.onchange(api || (api = make_api(selector)));
                   });
               }

               if ("function" === typeof that.onbefore) {
                   val.subscribe(function ( ) {
                       return that.onbefore(api || (api = make_api(selector)));
                   }, null, "beforeChange");
               }

               if ("function" === typeof that.onaddcell) {
                   that.onaddcell.call(that, row, selector);
               }
           };

           for (index in obj) {
               if (obj.hasOwnProperty(index)) {
                   convert(obj[index], index);
               }
           }

           if ("function" === typeof that.onaddrow) {
               that.onaddrow.call(that, row);
           }

           return obj;
       };

       if (!ko.isObservableArray(that.rows)) {
           // TODO: preserve subscriptions
           if (ko.isObservable(that.rows)) {
               console.warn("grid: rows losing subscriptions, " +
                  "make observable array");
           }
           that.rows = ko.observableArray(ko.unwrap(this.rows));
       }

      if ("function" === typeof that.onrequest) {
           that.refresh = function ( ) {
               that.onrequest.call(this, {
                   start: that.start.peek()
               ,   count: that.count.peek()
               ,   search: that.search.peek()
               ,   order: that.order.peek()
               ,   filters: that.filters.peek()
               },
               function ( error, rows ) {
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

       [   "start"
       ,   "count"
       ,   "search"
       ,   "order"
       ,   "filters"
       ].forEach(function ( name ) {
           if (!ko.isObservable(that[name])) {
               that[name] = ko.observable(that[name]);
           }

           if ("function" === typeof that.onrequest) {
               that[name].subscribe(that.refresh);
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
    */
   ko.grid.ColumnModel = function ( options ) {
       
       if (!this) {
           return new ko.grid.ColumnModel(options);
       }

       if ("string" === typeof options) {
           this.name = options;
       } else if (options instanceof Object) {
           $.extend(this, options);
       }

       if (this.control) {
           this.title = "";
           this.className = (this.className || "") + " control";
           this.orderable = false;
           this.defaultContent = "";
           this.type = ko.grid.TYPE_CONTROL;
       }
       
       if (this.type === void 0) {
           this.type = ko.grid.TYPE_TEXT;
       }

       if (this.name === void 0) {
           this.name = pid_generator.column();
       }

       if (this.title === void 0) {
           this.title = this.name
               .replace(/_/g, " ")
               .replace(/([a-z])([A-Z])/g, "$1 $2");
       }

       if (this.template === void 0) {
           this.template = ko.grid.templates[this.type] || this.type;
       } else {
           this.template = ko.grid.templates[this.template] || this.template;
       }

       if (this.header === void 0) {
           this.header = make_element("span", make_binding({text: "value"}));
       }

       if (this.footer === void 0) {
           this.footer = "";
       }
       
       if(!ko.isObservable(this.visible)) {
           this.visible = ko.observable(this.visible !== undefined ? this.visible : true);
       }

       unwrap_template.call(this);
       unwrap_template.call(this, "header");
       unwrap_template.call(this, "footer");
   };

   // ========== SELECTION MODELS ==========

   /**
    * base selection model class
    * @memberof ko.grid
    * @class SelectionModel
    * @abstract
    * @param {Object} [options] fine tune controls
    * @param {String} [options.class="active"] classname to apply on select
    * @param {String} [options.modifier="shift"] key to activate modified state
    * @param {Object|Function} [options.selected=ko.observable] selected item
    * @param {Function} [options.onchange=null] called when selection changes
    * @param {Function} [options.onbefore=null] called before selection change
    * @param {Function} [options.onregister] called to register a row
    * @example
    *  new ko.grid.SelectionModel({
    *    onregister: function ( row ) {
    *      $(row.node()).click(this.select.bind(this, row));
    *    }
    *  });
    */
   ko.grid.SelectionModel = function ( options ) {

       if (!this) {
           return new ko.grid.SelectionModel(options);
       }

       $.extend(this, {
           class: "active"
       ,   modifier: "shift"
       ,   selected: ko.observable()
       ,   onchange: null
       ,   onbefore: null
       ,   onregister: function ( row ) {
               $(row.node()).click(this.select.bind(this, row));
           }
       }, options);

       this.modifier = this.modifier + "Key";

       if (!ko.isObservable(this.selected)) {
           this.selected = ko.observable(this.selected);
       }

       if ("function" === typeof this.onchange) {
           this.selected.subscribe(this.onchange);
       }

       if ("function" === typeof this.onbefore) {
           this.selected.subscribe(this.onbefore, null, "beforeChange");
       }

       this.select = function ( ) {
           throw new Error("grid: selection model is abstract");
       };
   };

   /**
    * @class RowSelectionModel
    * @memberof ko.grid
    */ // TODO: document
   ko.grid.RowSelectionModel = function ( options ) {
       var last_elem;

       if (!this) {
           return new ko.grid.RowSelectionModel(options);
       }

       ko.grid.SelectionModel.call(this, options);

       this.select = function ( row, evt ) {
           var $row = $(row.node());
           if (this.selected() === row) {
               if (evt[this.modifier]) {
                   this.selected(null);
                   $row.removeClass(this.class);
                   last_elem = null;
               }
           } else {
               this.selected(row);
               $row.addClass(this.class);
               if (last_elem) {
                   last_elem.removeClass(this.class);
               }
               last_elem = $row;
           }
       };
   };

   ko.grid.MultiRowSelectionModel = function ( options ) {
       if (!this) {
           return new ko.grid.MultiRowSelectionModel(options);
       }

       options = $.extend({
           selected: ko.observableArray([ ])
       }, options);

       if (!ko.isObservableArray(options.selected)) {
           options.selected = ko.observableArray(ko.unwrap(options.selected));
       }

       ko.grid.SelectionModel.call(this, options);

       this.select = function ( row, evt ) {
           var $row = $(row.node()), sel, sels = this.selected();
           if (evt[this.modifier]) {
               if (-1 !== sels.indexOf(row)) {
                   this.selected.remove(row);
                   $row.removeClass(this.class);
               } else {
                   this.selected.push(row);
                   $row.addClass(this.class);
               }
           } else {
               if (sels.length !== 1 || sels[0] !== row) {
                   for (sel in sels) {
                       $(sels[sel].node()).removeClass(this.class);
                   }
                   this.selected([row]);
                   $row.addClass(this.class);
               } else if (sels[0] === row && evt[this.modifier]) {
                   this.selected([]);
                   $row.removeClass(this.class);
               }
           }
       };
   };

   // TODO: cell selection model

   // ========== CHILD MODEL ==========

   /**
    * model for child rows
    * @static
    * @memberof ko.grid
    * @class ChildModel
    * @param {Object|String} options fine tune controls or template
    * @param {String} options.template how to render this child
    * @param {String} [options.data] overrides row data for context
    * @param {Function} [options.onshowbefore] called before child is shown
    * @param {Function} [options.onshowafter] called after child is shown
    * @param {Function} [options.onhidebefore] called before child is hidden
    * @param {Function} [options.onhideafter] called after child is hidden
    * @param {Object|Boolean} [options.animate]
    * options for animation, don't if falsey
    */
   ko.grid.ChildModel = function ( options ) {

       if (!(this instanceof ko.grid.ChildModel)) {
           return new ko.grid.ChildModel(options);
       }

       if ("string" === typeof options) {
           options = { template: options };
       }

       $.extend(this, {
           onshowbefore: null
       ,   onhidebefore: null
       ,   onshowafter: null
       ,   onhideafter: null
       ,   animate: null
       }, options);

       if (!this.name) {
           this.name = pid_generator.child();
       }

       if (!this.template) {
           throw new Error("grid: child model requires template");
       }

       if (this.animate && this.animate.constructor !== Object) {
           this.animate = { };
       }

       unwrap_template.call(this);

       this.template =
           "<div class='grid_child_wrapper'" +
           (this.animate ? " style='display:none'>" : ">") +
           this.template + "</div>";
   };

   // ========== KO BINDING ==========

   /**
    * type detection, override to provide custom detection
    * @static
    * @memberof ko.grid
    * @function detect_type
    * @param {Any} item item to detect type of
    * @return {String} type of passed item
    * @example
    *   var old_detect = ko.grid.detect_type;
    *   ko.grid.detect_type = function ( item ) {
    *       if ("MyClass" === item.constructor.name) {
    *           return "mytype";
    *       }
    *       return old_detect(item);
    *   };
    */
   ko.grid.detect_type = function ( item ) {
       switch (item.constructor.name) {
           case "Boolean":
               return ko.grid.TYPE_CHECKBOX;
           case "String":
               return ko.grid.TYPE_STRING;
           default:
               return ko.grid.TYPE_TEXT;
       }
   };

   /**
    * generator for column models
    * @private
    * @static
    * @memberof ko.grid
    * @function create_column_models
    * @param {Object} settings binding handler settings
    */ // TODO: finish documenting settings
   ko.grid.create_column_models = function ( settings ) {
       var data, index;
       settings.columnModels = [ ];

       if (!(data = settings.dataModel.rows()[0])) {
           throw new Error("grid: cannot generate columns with no data");
       }

       if (!(data instanceof Array)) {
           settings.usejson = true;
       }

       for (index in data) {
           settings.columnModels.push(new ko.grid.ColumnModel({
               name: index
           ,   type: (settings.readonly || index.indexOf("_") === 0)
               ? "text" : ko.grid.detect_type(ko.unwrap(data[index]))
           }));
       }
   };

   /**
    * setup and normalize column models
    * @private
    * @static
    * @memberof ko.grid
    * @function prepare_column_models
    * @param {Object} settings binding handler settings
    * @return {Element} row template
    */ // TODO: finish documenting settings
   ko.grid.prepare_column_models = function ( settings ) {
       var index
       ,   model
       ;

       if (!settings.columnModels) {
           ko.grid.create_column_models(settings);
       }

       for (index in settings.columnModels) {
           model = settings.columnModels[index];
           if (!(model instanceof ko.grid.ColumnModel)) {
               settings.columnModels[index] = model =
                   new ko.grid.ColumnModel(model);
           }
           // correct data members
           if (settings.dataModel.usejson && model.data === void 0) {
               model.data = model.name;
           }
           if (settings.order === void 0 && model.orderable !== false) {
               settings.order = index;
           }
           // add convenience members
           model.index = index;
           model.value = model.data ? model.name : index;
           // auto detect settings
           if (model.searchable) {
               settings._searchable = true;
           }

           model._template = $("<td>");
           model._template.append(model.template);

           model._template = model._template[0];

           new ko.templateSources.anonymousTemplate(model._template)
               .nodes(model._template);

           model._header = $("<th>");
           model._header.append(model.header);

           model._header = model._header[0];

           new ko.templateSources.anonymousTemplate(model._header)
               .nodes(model._header);

           model._footer = $("<th>");
           model._footer.append(model.footer);

           model._footer = model._footer[0];

           new ko.templateSources.anonymousTemplate(model._footer)
               .nodes(model._footer);
       }
   };

   // TODO: document
   ko.grid.prepare_child_models = function ( row, context, models ) {
       var children = [ ]
       ,   templates = models.map(function ( model ) {
               return model.template;
           });

       row.children = { };

       row.children.shown = row.child.isShown;
       row.children.hidden = function ( ) {
           return !row.children.shown();
       };

       row.children.show = function ( ) {
           if (row.children.hidden()) {
               row.child(templates).show();
               children = [ ];
               row.child().each(function ( index ) {
                   var child, data, model = models[index];

                   this.setAttribute("role", "child");

                   children.push(child = this.children[0].children[0]);

                   if (model.onshowbefore instanceof Function) {
                       data = model.onshowbefore(child, row);
                   }

                   ko.applyBindings(context.createChildContext(
                   model.data || data || {
                       row: row, data: row.data()
                   }, "child"), child);

                   if (model.animate) {
                       $(child).slideDown(model.animate);
                   }

                   if (model.onshowafter instanceof Function) {
                       model.onshowafter(child, row);
                   }
               });
           }
       };

       row.children.hide = function ( ) {
           var count = 0
           ,   done = function (  ) {
                   if (count++ === children.length) {
                       row.child.hide();
                   }
               };
           if (row.children.shown()) {
               children.forEach(function ( child, index ) {
                   var model = models[index];

                   if (model.onhidebefore instanceof Function) {
                       model.onhidebefore(child, row);
                   }
                   if (model.animate) {
                       model.animate._complete = model.complete;
                       model.animate.complete = function ( ) {
                           if (model.animate._complete instanceof Function) {
                               model.animate._complete.apply(this, arguments);
                           }
                           if (model.onhideafter instanceof Function) {
                               model.onhideafter(child, row);
                           }
                           done();
                       };
                       $(child).slideUp(model.animate);
                   } else {
                       if (model.onhideafter instanceof Function) {
                           model.onhideafter(child, row);
                       }
                       done();
                   }
               });
               done();
           }
       };
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
       // TODO: document valueAccessor properties
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
           var settings, options, table, api, $element, index,
               model, bind_cells;

           if (!(element instanceof HTMLTableElement)) {
               throw new TypeError("grid: expected table element");
           }

           $element = $(element);

           settings = valueAccessor() || { };
           settings.options = settings.options || { };
           options = settings.options;

           // settings normalization
           if (!(settings.dataModel instanceof ko.grid.DataModel)) {
               settings.dataModel = new ko.grid.DataModel(settings.dataModel);
           }

           ko.grid.prepare_column_models(settings);

           if (settings.childrenModels) {
               settings.childrenModels =
               settings.childrenModels.map(function ( template ) {
                   if (!(template instanceof ko.grid.ChildModel)) {
                       template = new ko.grid.ChildModel(template);
                   }
                   return template;
               });
           }

           settings.columnModelsMap = { };
           for (index in settings.columnModels) {
               model = settings.columnModels[index];
               settings.columnModelsMap[model.name] = model;
           }

           // options construction
           options.columns = settings.columnModels;
           options.data = ko.unwrap(settings.dataModel.rows);
           options.order = options.order || [[settings.order, "asc"]];
           options.serverSide =
               settings.dataModel.onrequest instanceof Function;
           if (!options.dom) {
               options.dom = (options.allowColumnReorder ? "R" : "") +
                   "ti" + (options.scrollY ? "S" : "p") +
                   (settings._searchable ? "f" : "");
           }
           if (options.serverSide) {
               options.ajax = options.ajax || function ( data, callback ) {
                   if (!settings.server_callback) {
                       settings.server_callback = callback;
                   }
                   //* handle all column filters
                   if (data.columns) {
                       var filters = data.columns
                           .filter(function(col){
                               if(col.search.value !== ""){
                                   return true;
                               } else { 
                                   return false;
                               }})
                           .map(function(col){
                                   var obj = {},
                                       columnName = col.data;
                                       obj[columnName] = col.search.value;
                               return obj;
                            });    
                       if( !deep_compare(filters, settings.dataModel.filters.peek()) ){
                           settings.dataModel.filters( filters );
                       }  
                   }
                   settings.dataModel.start(data.start);
                   settings.dataModel.count(data.length);
                   settings.dataModel.search(data.search.value);
                   
                   var order = {};
                   data.order.forEach(function(o){
                     order[data.columns[o.column].name] = { 'dir': o.dir, 'type': settings.columnModels[o.column].type };
                   });

                    
                   if ( !deep_compare( settings.dataModel.order.peek(), order ) ) {
                       settings.dataModel.order(order);
                   }
               };
           }
           bind_cells = function ( row, rowContext, data, template ) {
               var column, column_api, cellContext,
                   api = this.api();

               var index = 0;
               Array.prototype.slice.call(row.children).forEach(
               function ( cell ) {
                    while(!api.column(index).visible()) {
                        index++;
                    }
                   if (!cell._bindings) {
                       column = settings.columnModelsMap[
                           (column_api = api.column(index)).dataSrc()
                       ];
                       column.api = column_api;
                       cellContext = rowContext.createChildContext({
                           value: data[column.value] || column.title
                       ,   column: column
                       }, "cell");

                       cell.className +=
                           " type_" + column.type +
                           " name_" + column.name;
                       ko.renderTemplate(column[template],
                           cellContext, { }, cell, "replaceChildren");

                       cell._bindings = cellContext;
                   }
                   index++;
               });
           };

           settings._row_callback = options.createdRow;
           settings._row_bindings = new window.WeakMap();

           options.createdRow = function ( row, data ) {
               var _row, rowContext, binding;

               api     = this.api();
               _row    = api.row($(row));
               data    = settings.dataModel.mapper(_row);

               rowContext = bindingContext.createChildContext(data, "row");
               rowContext.$api = _row;

               settings._row_bindings.set(data, binding =
                   bind_cells.bind(this, row, rowContext, data, "_template"));
               binding();

               if (settings.childrenModels) {
                   ko.grid.prepare_child_models(
                       _row, rowContext, settings.childrenModels);
               }

               if (settings._row_callback instanceof Function) {
                   settings._row_callback.apply(this, arguments);
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

           settings._header_callback = options.headerCallback;
           settings._header_binding = null;

           options.headerCallback = function ( row, data ) {
               var headerContext, api;
               api = this.api();

               headerContext = bindingContext.createChildContext(data, "row");

               settings._header_binding = bind_cells.bind(
                   this, row, headerContext, data, "_header");
               settings._header_binding();

               if (settings._header_callback instanceof Function) {
                    settings._header_callback.apply(this, arguments);
               }
           };

           table = $element.dataTable(options);
           element._kodt = api = table.api();
           
           function setupColumnModels() {
                // add tooltips to column headers
                settings.columnModels.forEach(function(model, index) {
                        // if(model.tooltip) {
                        //     $("th.name_" + model.name).prop("title", model.tooltip);
                        // }
                        if(ko.isObservable(model.visible)) {
                            model.visible.subscribe(function(visible) {
                                api.column(index).visible(visible);
                                if(api.epResponsive) {
                                    api.epResponsive.setIgnoreColumn(index, !visible);
                                }
                            });
                        }
                }); 
           }

           setupColumnModels();

           var before, diff;
           // TODO: replace with ko array diff
           diff = function ( arr1, arr2 ) {
               return arr1.filter(function ( item ) {
                   return !~arr2.indexOf(item);
               });
           };

           var subscribe_before, subscribe_change;
           subscribe_before = settings.dataModel.rows.subscribe(
           function ( items ) {
               before = items.slice(0);
           }, null, "beforeChange");
           subscribe_change = settings.dataModel.rows.subscribe(
           function ( items ) {
               //var nodes, count;
               if (settings.server_callback) {
                   settings.server_callback({
                       data: items
                       // TODO: get total from callback
                   ,   recordsTotal: settings.dataModel.serverTotal ? settings.dataModel.serverTotal() : items.length
                   ,   recordsFiltered: settings.dataModel.serverTotal ? settings.dataModel.serverTotal() : items.length
                   });
                   // update tooltips since server call probably overwrote headers
                   setupColumnModels();
               } else {
                   var removed = diff(before, items)
                   ,   added = diff(items, before)
                   ;

                   removed.forEach(function ( item ) {
                       api.row(function ( index, data ) {
                           return item === data;
                       }).remove();
                   });

                   api.rows.add(added);

                   api.draw();
               }
           });

           if (settings.api instanceof Function) {
               // keep for backwards compat
               settings.api(api, table);
           }

           if (settings.oncreatetable instanceof Function) {
               settings.oncreatetable(api, table);
           }

           ko.utils.domNodeDisposal.addDisposeCallback(element, function ( ) {
               subscribe_before.dispose();
               subscribe_change.dispose();

               api.destroy();

               if (settings.ondestroytable instanceof Function) {
                   settings.ondestroytable(api, table);
               }
           });
           
           if(api.epResponsive && ko.isObservable(options.epResponsive.resizeObservable)) {
                api.epResponsive.setOptions(options.epResponsive.options);
               
                api.epResponsive.onResize(function ( hiddenColumns) {
                        
                    options.epResponsive.resizeObservable({
                        columns: api.settings()[0].oInit.columns,
                        hiddenColumns: hiddenColumns,
                    });
                
                    // reapply bindings to the newly visible columns
                    setTimeout(function () {
                        settings._header_binding();
             
                        settings.dataModel.rows.peek().forEach(
                        function ( data ) {
                            settings._row_bindings.get(data)();
                        });
                    });
                });
           }
                      
            // apply initial visibility
            settings.columnModels.forEach(function(column, index) {
                api.column(index).visible(column.visible());
                if(api.epResponsive) {
                    api.epResponsive.setIgnoreColumn(index, !column.visible());
                }
            });   
           
           // apply initial order
           if(settings.dataModel.initialOrder) {
               table.fnSort(settings.dataModel.initialOrder);
           }
           
           return { controlsDescendantBindings: true };
       }
   };
});