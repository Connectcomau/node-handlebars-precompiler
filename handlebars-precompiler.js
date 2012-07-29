// Modified version of https://github.com/wycats/handlebars.js/blob/master/bin/handlebars
// Changed from command-line compiler to node module

var fs = require('fs');
var handlebars = require('handlebars');
var basename = require('path').basename;
var uglify = require('uglify-js');

function check_files(opts) {
	(function(opts) {
		if ( ! opts.templates.length) {
			throw 'Must define at least one template or directory.';
		}

		opts.templates.forEach(function(template) {
			try {
				fs.statSync(template);
			} 
			catch (err) {
				throw 'Unable to open template file "' + template + '"';
			}
		});
	}(opts));	
}

function do_precompile(opts) {
	//check all files first
	check_files(opts);

	var template = opts.templates[0];
	var output = [];
	output.push('(function() {\n  var template = Handlebars.template, templates = Handlebars.templates = Handlebars.templates || {};\n');

	function processTemplate(template, root) {
		var stat = fs.statSync(template);

		// make the filename regex user-overridable
		var fileRegex = /\.handlebars$/;
		if (opts.fileRegex) fileRegex = opts.fileRegex;
		
		if (stat.isDirectory()) {
			fs.readdirSync(template).map(function(file) {
				var path = template + '/' + file;

				if (fileRegex.test(path) || fs.statSync(path).isDirectory()) {
					processTemplate(path, root || template);
				}
			});
		} else {
			var data = fs.readFileSync(template, 'utf8');

			// Clean the template name
			if ( ! root) {
				template = basename(template);
			} 
			else if (template.indexOf(root) === 0) {
				template = template.substring(root.length+1);
			}

			template = template.replace(fileRegex, '');
			output.push('templates[\'' + template + '\'] = template(' + handlebars.precompile(data) + ');\n');
		}
	}

	opts.templates.forEach(function(template) {
		processTemplate(template, opts.root);
	});

	// Output the content
	output.push('})();');
	output = output.join('');

	if (opts.min) {
		var ast = uglify.parser.parse(output);
		ast = uglify.uglify.ast_mangle(ast);
		ast = uglify.uglify.ast_squeeze(ast);
		output = uglify.uglify.gen_code(ast);
	}

	if (opts.output) {
		fs.writeFileSync(opts.output, output, 'utf8');
	} else {
		return output;
	}
}

function compile(dir, outfile, extensions) {
	var regex = /\.handlebars$/;
	if (extensions) {
		regex = new RegExp('\.' + extensions.join('$|\.') + '$');
	}

	console.log('[compiling] ' + outfile);

	return do_precompile({
		templates: [dir],
		output: outfile,
		fileRegex: regex,
		min: true
	});
}

function watch_dir(dir, outfile, extensions) {
	var fs = require('fs');
	var file = require('file');
	var regex = /\.handlebars$/;
	var compileOnChange = function(event, filename) {
		console.log('[' + event + '] detected in ' + (filename ? filename : '[filename not supported]'));
		compile(dir, outfile, extensions);
	}

	if (extensions) {
		regex = new RegExp('\.' + extensions.join('$|\.') + '$');
	}

	console.log('[watching] ' + dir);

	file.walk(dir, function(_, dirPath, dirs, files) {
		if (files) {
			for(var i = 0; i < files.length; i++) {
				var file = files[i];
				if (regex.test(file)) {
					fs.watch(file, compileOnChange);
				}
			}
		}
	});
}

exports.compile = compile
exports.watch_dir = watch_dir