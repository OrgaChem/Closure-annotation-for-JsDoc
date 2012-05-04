var flag = true;

JSDOC.PluginManager.registerPlugin(
  "JSDOC.closureLibraryBond",
  {
    onDocTag: function(tag) {
      var type = tag.type;
      // add Null to type if the type contains "?", such as: {?Array}
      type = type.replace(/\?([a-zA-Z_$][a-zA-Z0-9_$.]*[a-zA-Z0-9_$])/g,
                          '$1|Null');
      // remove "!" if the type contains "!", such as: {!Array}
      type = type.replace(/!/g, '');
      // set optional if the last character is "=", such as: {Array=}
      if (type.match(/=$/)) tag.isOptional = 'true';
      // add Undefined to type if the type contains "=", such as: {Array=}
      type = type.replace(/=/g, '|Undefined');
      // replace to capital cases
      type = type.replace(/string/g, 'String');
      type = type.replace(/boolean/g, 'Boolean');
      type = type.replace(/number/g, 'Number');
      // escapes "<" and ">", if the data type annotation has characters.
      type = type.replace(/</g, "&lt;");
      type = type.replace(/>/g, "&gt;");
      tag.type = type;
    },
    onDocCommentSrc: function(comment) {
      // @implements tag converts to @extends tag
      comment.src = comment.src.replace(/@implements/i, "@extends");
      comment.src = comment.src.replace(/@enum .*/i, "@namespace");
      // @const tag converts to @constant tag
      comment.src = comment.src.replace(/@const */i, "@constant");
      // @extends tag and @type tag have type description on closure,
      // but each tags reqiure namepath on JsDoc.
      comment.src = comment.src.replace(/@extends \{([^\}]+)\}/i,
                                        "@extends $1");
      // if this object has @param or @return, it might be a function. But it
      // should not add @function, when the object has a @constructor tag.
      if (comment.src.match(/@(param|return)/) &&
          !comment.src.match(/@constructor/)) {
        comment.src += '@function\n';
      }
      if (comment.src.match(/^Base namespace for the Closure library/)) {
        LOG.warn('goog found');
        comment.src.replace(/@const/, '@namesoace');
      }
    },
    onFunctionCall: function(info) {
      if (info.name === 'goog.provide') {
        var name = info.tokenStream[1].data.replace(/'/g, '');
        // if goog.provide is called, it provide namespace that has a name from
        // the argument.
        if (name.match(/(\.[a-z_$][a-zA-Z0-9_$]+$|^[a-z_$]+$)/)) {
          // it doesn't work, and the cause was unkwoun.
          // Namespace(name);
          var text = [
            '/**',
            ' * @namespace',
            ' * @name ' + name,
            ' */'
          ].join('\n');
          info.doc = text;
        }
      } else if (info.name === 'goog.addSingletonGetter') {
        // if goog.addSingletonGetter is called, it adds a ".getInstance"
        // method to the object from argument.
        var name = info.tokenStream[1].data.replace(/'/g, '');
        var text = [
          '/**',
          ' * @function',
          ' * @name ' + name + '.getInstance',
          ' * @return {' + name + '} An unique instance.',
          ' */'
        ].join('\n');
        info.doc = text;
      }
    }
  }
);
