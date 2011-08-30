/*!
 * picosnippet v1.4
 * http://www.tobez.org/picosnippet/
 *
 * Copyright 2010, Anton Berezin
 * Modified BSD license.
 * http://www.tobez.org/picosnippet/license.txt
 *
 * Date: Thu Jun 24 13:30:41 CEST 2010
 */
function picosnippet(template, d)
{
	/*
	- iterate over template breadth-first
    - for every class match in d
		- do simple substitution (text or value) if d is a scalar
		- recurse into d if d is an array (will remove node if empty array)
		- do compound substitution if d is an object (= hash)
	*/
	var subst = function(e,v) {
		var content_changed = false;
		if (v instanceof Object) {
			for (a in v) {
				if (a == "text") {
					e.innerHTML = v[a];
					content_changed = true;
				} else {
					e.setAttribute(a, v[a]);
				}
			}
		} else if (e.nodeName == "INPUT") {
			e.value = v;
		} else {
			e.innerHTML = v;
			content_changed = true;
		}
		return content_changed;
	};
	var result = template.cloneNode(true);
	// in IE 7.0, one cannot delete el.id... :-/
	result.id = "";
	var err;
	try { delete result.id; } catch (err) { /* do nothing */ }
	// result.innerHTML = template.innerHTML;  - this is broken for <tr> in modern FF
	var q = [result];
	var i = 0;
	while (i < q.length) {
		var t = q[i++];
		if (t.nodeType != 1) continue;
		var cl = t.className.split(' ');
		var cll = cl.length;
		var untouched = true;
		for (var k = 0; k < cll; k++) {
			var cln = cl[k];
			if (cln == "")	continue;
			if (!(cln in d))	continue;
			if (d[cln] instanceof Array) {
				var rr = [];
				var a = d[cln];
				var al = a.length;
				for (var j = 0; j < al; j++) {
					var c;
					if (a[j] instanceof Object) { // assume a hash
						c = picosnippet(t, a[j]);
					} else {
						c = t.cloneNode(false);
						subst(c,a[j]);
					}
					rr[rr.length] = c;
				}
				var rrl = rr.length;
				for (j = 0; j < rrl; j++) {
					t.parentNode.insertBefore(rr[j], t);  // XXX parent node might not be there
				}
				t.parentNode.removeChild(t);
				untouched = false;
			} else {
				untouched = !subst(t,d[cln]);
			}
			break;
		}
		if (untouched) {
			var chl = t.children.length;
			for (k = 0; k < chl; k++)
				q[q.length] = t.children[k];
		}
	}
	return result;
}
