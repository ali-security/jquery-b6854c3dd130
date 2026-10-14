// The 1.12.1 npm package ships a stray jQuery 3.0.0-beta1 slim build
// (dist/jquery.slim.js, .min.js, .min.map) from jquery-dist's master, which
// the release published as-is and grunt never rebuilds. This Gruntfile ports
// the CVE fixes into that jquery.slim.js, as upstream wrote them for 3.x, and
// re-minifies it with this release's uglify options; the banner is the first
// line of the published jquery.slim.min.js.
// Usage: grunt --gruntfile .github/seal-slim.js --base . --dist=<dir>
var fs = require( "fs" );

module.exports = function( grunt ) {
	var dist = grunt.option( "dist" ),
		srcLoc = dist + "/jquery.slim.js",
		minLoc = dist + "/jquery.slim.min.js",
		files = {},
		fixes = [

			// CVE-2019-11358 (upstream 753d591)
			[
				"\t\t\t\t// Prevent never-ending loop\n" +
				"\t\t\t\tif ( target === copy ) {\n",

				"\t\t\t\t// Prevent Object.prototype pollution\n" +
				"\t\t\t\t// Prevent never-ending loop\n" +
				"\t\t\t\tif ( name === \"__proto__\" || target === copy ) {\n"
			],

			// CVE-2020-11023 (upstream 1d61fd9, 966a709): wrap <option> and
			// <optgroup> in <select multiple> only where IE <=9 needs it. The
			// wrapMap is defined above the support probe in this build, so the
			// conditional wrapper goes after the probe.
			[
				"var wrapMap = {\n" +
				"\n" +
				"\t// Support: IE9\n" +
				"\toption: [ 1, \"<select multiple='multiple'>\", \"</select>\" ],\n" +
				"\n",

				"var wrapMap = {\n" +
				"\n"
			],
			[
				"// Support: IE9\n" +
				"wrapMap.optgroup = wrapMap.option;\n" +
				"\n",

				""
			],
			[
				"\tsupport.noCloneChecked = !!div.cloneNode( true ).lastChild.defaultValue;\n" +
				"} )();\n",

				"\tsupport.noCloneChecked = !!div.cloneNode( true ).lastChild.defaultValue;\n" +
				"\n" +
				"\t// Support: IE <=9 only\n" +
				"\t// IE <=9 replaces <option> tags with their contents when inserted outside of\n" +
				"\t// the select element.\n" +
				"\tdiv.innerHTML = \"<option></option>\";\n" +
				"\tsupport.option = !!div.lastChild;\n" +
				"} )();\n" +
				"\n" +
				"// Support: IE <=9 only\n" +
				"// IE <=9 replaces <option> tags with their contents when inserted outside of\n" +
				"// the select element.\n" +
				"if ( !support.option ) {\n" +
				"\twrapMap.optgroup = wrapMap.option = [ 1, \"<select multiple='multiple'>\", \"</select>\" ];\n" +
				"}\n"
			],

			// CVE-2020-11022 (upstream 1d61fd9): htmlPrefilter is the identity
			[
				"\trxhtmlTag = /<(?!area|br|col|embed|hr|img|input|link|meta|param)" +
				"(([a-z][^\\/\\0>\\x20\\t\\r\\n\\f]*)[^>]*)\\/>/gi,\n",

				""
			],
			[
				"\t\treturn html.replace( rxhtmlTag, \"<$1></$2>\" );\n",

				"\t\treturn html;\n"
			],

			// CVE-2016-10707 (upstream e06fda6): key the attrHandle swap by the
			// lowercase name
			[
				"\t\tvar ret, handle;\n" +
				"\t\tif ( !isXML ) {\n" +
				"\n" +
				"\t\t\t// Avoid an infinite loop by temporarily removing this function from the getter\n" +
				"\t\t\thandle = attrHandle[ name ];\n" +
				"\t\t\tattrHandle[ name ] = ret;\n" +
				"\t\t\tret = getter( elem, name, isXML ) != null ?\n" +
				"\t\t\t\tname.toLowerCase() :\n" +
				"\t\t\t\tnull;\n" +
				"\t\t\tattrHandle[ name ] = handle;\n",

				"\t\tvar ret, handle,\n" +
				"\t\t\tlowercaseName = name.toLowerCase();\n" +
				"\n" +
				"\t\tif ( !isXML ) {\n" +
				"\n" +
				"\t\t\t// Avoid an infinite loop by temporarily removing this function from the getter\n" +
				"\t\t\thandle = attrHandle[ lowercaseName ];\n" +
				"\t\t\tattrHandle[ lowercaseName ] = ret;\n" +
				"\t\t\tret = getter( elem, name, isXML ) != null ?\n" +
				"\t\t\t\tlowercaseName :\n" +
				"\t\t\t\tnull;\n" +
				"\t\t\tattrHandle[ lowercaseName ] = handle;\n"
			]
		];

	files[ minLoc ] = [ srcLoc ];

	grunt.initConfig( {
		uglify: {
			slim: {
				files: files,
				options: {
					preserveComments: false,
					sourceMap: true,
					sourceMapName: dist + "/jquery.slim.min.map",
					report: "min",
					beautify: {
						"ascii_only": true
					},
					banner: fs.readFileSync( minLoc, "utf8" ).split( "\n" )[ 0 ],
					compress: {
						"hoist_funs": false,
						loops: false,
						unused: false
					}
				}
			}
		}
	} );

	grunt.loadNpmTasks( "grunt-contrib-uglify" );

	grunt.registerTask( "seal_patch_slim", function() {
		var text = fs.readFileSync( srcLoc, "utf8" );
		fixes.forEach( function( fix, i ) {
			if ( text.split( fix[ 0 ] ).length !== 2 ) {
				grunt.fail.fatal( "slim fix " + i + " does not match exactly once" );
			}
			text = text.replace( fix[ 0 ], function() {
				return fix[ 1 ];
			} );
		} );
		fs.writeFileSync( srcLoc, text );
	} );

	// As this release's remove_map_comment task (build/tasks/sourcemap.js)
	grunt.registerTask( "remove_map_comment", function() {
		var text = fs.readFileSync( minLoc, "utf8" )
			.replace( /\/\/# sourceMappingURL=\S+/, "" );
		fs.writeFileSync( minLoc, text );
	} );

	grunt.registerTask( "default", [ "seal_patch_slim", "uglify", "remove_map_comment" ] );
};
