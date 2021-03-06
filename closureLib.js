// This script licensed under the MIT.
// http://orgachem.mit-license.org

JSDOC.PluginManager.registerPlugin(
  "JSDOC.closureLibraryBond",
	{
		onDocTag: function(tag) {
			var type = tag.type;
			// add Null to type if the type contains "?", such as: {?Array}
			type = type.replace(/\?([a-zA-Z_$][a-zA-Z0-9_$.]*[a-zA-Z0-9_$])/g,
													'$1|null');
			// remove "!" if the type contains "!", such as: {!Array}
			type = type.replace(/!/g, '');
			// set optional if the last character is "=", such as: {Array=}
			if (type.match(/=$/)) tag.isOptional = 'true';
			// add Undefined to type if the type contains "=", such as: {Array=}
			type = type.replace(/=/g, '|undefined');
			// replace to capital cases
			type = type.replace(/string/g, 'String');
			type = type.replace(/boolean/g, 'Boolean');
			type = type.replace(/number/g, 'Number');
			// escapes "<" and ">", if the data type annotation has characters.
			type = type.replace(/</g, '&lt;');
			type = type.replace(/>/g, '&gt;');
			tag.type = type;
		},
		onDocCommentSrc: function(comment) {
			// @extends tag and @type and @implements tag have type description on
			// closure, but the tag type descriptions are expected namepath by JsDoc.
			comment.src = comment.src.replace(/@extends \{([^\}]+)\}/i,
																				'@extends $1');
			comment.src = comment.src.replace(/@implements \{([^\}]+)\}/i,
																				'@implements $1');
			// if this object has @param or @return, it might be a function. But it
			// should not add @function, when the object has a @constructor tag.
			// if (comment.src.match(/@(param|return)/) &&
			//		 !comment.src.match(/@constructor/)) {
			//	 comment.src += '@function\n';
			// }
			if (comment.src.match(/^Base namespace for the Closure library/)) {
				LOG.warn('goog found');
				comment.src.replace(/@const/, '@namespace');
			}
		},
		// adapt to "goog.provide" and "goog.addSingletonGetter"
		onFunctionCall: function(info) {
			if (info.name === 'goog.provide') {
				// TODO: Implements a goog.provide behavior.
				//			 But now, it cannot get symbolSet,
				//			 so it works when onFinishedParsing is called.
			} else if (info.name === 'goog.addSingletonGetter') {
				// if goog.addSingletonGetter is called, it adds a ".getInstance"
				// method to the object from argument.
				if (info.tokenStream) {
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
		},
		onSymbol: function(symbol) {
			var typeTag, enumTag, defineTag;
			var types = symbol.comment.getTag('type');
			if (typeTag = types[0]) {
				symbol.closureType = typeTag.type;
			}

			var enums = symbol.comment.getTag('enum');
			if (enumTag = enums[0]) {
				symbol.isNamespace = true;
				symbol.isEnumerable = true;
				symbol.isConstant = true;
				symbol.enumType = enumTag.type;
			}

			var defines = symbol.comment.getTag('define');
			if (defineTag = defines[0]) {
				symbol.isDefine = true;
				symbol.isConstant = true;
				symbol.classDesc = defineTag.desc;
				symbol.closureType = defineTag.type;
			}

			var hierarchy = symbol.alias.split('.');
			symbol.parentSymbolAlias = hierarchy.slice(0, -1).join('.');
		},
		onFinishedParsing: function(symbolSet) {
			var symbols = symbolSet.toArray();
			var addParentSymbolIfNeccesary = function(symbol) {
				var parentAlias = symbol.parentSymbolAlias;
				if (parentAlias) {
					var parentSymbol = symbolSet.getSymbol(parentAlias);
					var appendMember = function(parentSymbol, symbol) {
						if (symbol.isNamespace) {
							parentSymbol.properties.push(symbol);
						} else if (symbol.is('CONSTRUCTOR')) {
							parentSymbol.methods.push(symbol);
						}
					};
					if (!parentSymbol) {
						var namepath = parentAlias.split('.');
						var name = namepath.pop();
						var newParentSymbol = new JSDOC.Symbol(
							/* String name              */ parentAlias,
							/* Array params             */ [],
							/* String isa               */ 'OBJECT',
							/* JSDOC.DOcComment comment */ new JSDOC.DocComment([
								'/**',
								' * @namespace',
								' * @name ' + name,
								' */'
							].join('\n'))
						);
						// The parent symbol was created this script do not have any members.
						// So, you should add members if the parent does not have own members.
						appendMember(newParentSymbol, symbol);
						symbolSet.addSymbol(newParentSymbol);
						LOG.inform('Add the namespace "' + name + '" to "' + namepath + '".');
						addParentSymbolIfNeccesary(newParentSymbol);
					} else {
						// The parent symbol was created this script do not have any members.
						// So, you should add members if the parent does not have own members.
						if (!parentSymbol.hasMember(symbol.alias)) {
							appendMember(parentSymbol, symbol);
						}
					}
				}
			};

			var members = symbols.filter(function(symbol) {
				// Elements of Enumerable setting
				var parentAlias, parentSymbol;
				if (parentAlias = symbol.memberOf) {
					if (parentSymbol = symbolSet.getSymbol(parentAlias)) {
						if (parentSymbol.isEnumerable) {
							symbol.isConstant = true;
							symbol.closureType = parentSymbol.enumType;
						}
					}
				}
				return !symbol.isNamespace && !symbol.is('FILE');
			});
			members.forEach(addParentSymbolIfNeccesary);
		}
	}
);
