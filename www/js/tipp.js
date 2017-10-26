var _URL;
var _VER;
var _CHANGELOG_PAGE_SIZE;
var _statusbar;
var _status_area;
var _SERVER_CAPS;
var _LINKIFY;
var _BIGFREE;
var _STATS_BY_CLASS;
var _PERMS = {};
function init()
{
	_URL = "cgi-bin/tipp.cgi";
	_VER = "2012092501";
	_CHANGELOG_PAGE_SIZE = 30;

	message("The status of the latest update is shown here");

	remote({ what: "config" }, function (res) {
		_SERVER_CAPS = res.caps;
		_LINKIFY = res.linkify;
		_PERMS = res.permissions;
		$("h1").text($("h1").text() + res.extra_header);
		document.title = document.title + res.extra_header;
		$("#login-name").html("Welcome, <strong>" + res.login + "</strong>");
		if (can("net")) $("#add-button-cell").show();
		if (can("range")) $("#add-range-button-cell").show();
		if (can("view_usage_stats")) $("#statistics-button-cell").show();
		if (can("superuser")) $("#settings-button-cell").show();
	});

	$("#search").focus();
	$('#search-button').click(function (ev) {
		ev.preventDefault();
		ev.stopPropagation();
		clear_selection();
		$("#main-content").remove();
		search();
	});
	$('#home-button').click(function (ev) {
		ev.preventDefault();
		ev.stopPropagation();
		clear_selection();
		$("#main-content").remove();
		browse();
	});
	$('#net-view-button').click(function (ev) {
		ev.preventDefault();
		ev.stopPropagation();
		clear_selection();
		$("#main-content").remove();
		net_view();
	});
	$('#tag-view-button').click(function (ev) {
		ev.preventDefault();
		ev.stopPropagation();
		clear_selection();
		$("#main-content").remove();
		tag_view();
	});
	$('#add-button').click(function (ev) {
		ev.preventDefault();
		ev.stopPropagation();
		clear_selection();
		add_network();
	});
	$('#changelog-button').click(function (ev) {
		ev.preventDefault();
		ev.stopPropagation();
		clear_selection();
		$("#main-content").remove();
		view_changes();
	});
	$('#add-range-button').click(function (ev) {
		ev.preventDefault();
		ev.stopPropagation();
		clear_selection();
		add_class_range();
	});
	$('#statistics-button').click(function (ev) {
		ev.preventDefault();
		ev.stopPropagation();
		clear_selection();
		$("#main-content").remove();
		stat_view();
	});
	$('#settings-button').click(function (ev) {
		ev.preventDefault();
		ev.stopPropagation();
		clear_selection();
		$("#main-content").remove();
		settings_view();
	});

	browse();
}

function browse()
{
	remote({}, function (res) {
		$(document).data("@classes", res);
		var $div = $("<div class='linklist' id='main-content'></div>");
		$div.append($("<h2>All classes &amp; networks</h2>"));
		var $ul  = $("<ul></ul>");
		$div.hide().append($ul);
		var n = res.length;
		for (var i = 0; i < n; i++) {
			var v = res[i];
			var $li = $("<li id='browse-class-" + v.id + "'><a class='browse-class' href='#'>" +
				'<span class="form-icon ui-icon ui-icon-carat-1-e"></span>' +
				v.name + "</a>" +
				"</li>");
			$ul.append($li);
			add_class_link($li.find("a.browse-class"), v.id);
		}
		$("#view").append($div);
		$("#main-content-XXX").selectable({
			filter: ".can-select",
			delay: 20,
			distance: 10,
			start: function () {
				$("#select-menu").remove();
			},
			stop: function (ev) {
				var $menu = $("<div id='select-menu'>" +
					"<ul>" +
					"<li>Cancel</li>" +
					"<li>&nbsp;</li>" +
					"<li>Merge networks</li>" +
					"<li>Export CSV</li>" +
					"</ul>" +
					"</div>");
				$menu.css({
					left: ev.clientX-30,
					top:  ev.clientY-24
				});
				$("#view").append($menu);
			}
		});
		$div.slideDown("fast");
	});
}

function net_view()
{
	remote({what: "top-level-nets"}, function (res) {
		var $div = $("<div class='linklist' id='main-content'></div>");
		$div.append($("<h2>Network view</h2>"));
		var $ul  = $("<ul></ul>");
		$div.hide().append($ul);
		var n = res.length;
		for (var i = 0; i < n; i++) {
			var v = res[i];
			var $li = $("<li class='class-range'><div>" +
				"<a href='#' class='show-net with-free without-free td-like' style='width: 14em;'>" +
				'<span class="form-icon ui-icon ui-icon-carat-1-e"></span>' +
				v + "</a>" + 
				"<span class='netinfo td-like' style='width: 1em;'></span>" +
				'<span class="buttons td-like">' + 
				button_icon("export-csv", "disk", "Export CSV") +
				"</span>" +
				"</div></li>");
			$ul.append($li);
			add_export_csv($li, {net: v}, 1, 1);
			add_net_link($li, { class_range_id: null, limit: v });
		}
		$("#view").append($div);
		$div.slideDown("fast");
	});
}

/*
				var $li = $("<li class='class-range'>" +
					"<div>" +
					// XXX this fixed width is unsatisfactory for IPv6
					// XXX maybe this <li> should be table-like
					"<a href='#' class='show-net without-free td-like' style='width: 14em;'>" +
					'<span class="form-icon ui-icon ui-icon-carat-1-e"></span>' +
					v.net + "</a>" +
					"<span class='netinfo td-like' style='width: 7em;'> " +
					"<a href='#' class='show-net with-free'>" + free_space + " free</a>" +
					"</span>" +
					'<span class="buttons td-like">' + 
					maybe("range", class_id, button_icon("edit-range", "document", "Edit range")) +
					(v.addresses == 0 ? "" :
					' ' + maybe("net", class_id, button_icon("allocate", "plus", "Allocate network in this range"))) +
					(v.used != 0 ? "" :
					' ' + maybe("range", class_id, button_icon("delete-range", "close", "Delete this range"))) +
					(v.used == 0 ? "" :
					' ' + button_icon("export-csv", "disk", "Export CSV")) +
					"</span>" +
					'<span class="description td-like">' + v.descr +
					"</span>" +
					"<span class='extras-here'></span></div></li>");
*/

function tag_view()
{
	remote({what: "tags-summary"}, function (res) {
		var $div = $("<div class='linklist' id='main-content'></div>");
		$div.append($("<h2>Tags view</h2>"));
		var $tags = snippet("tags-summary", { tags: res });
		$tags.find('tr:nth-child(odd)').not('tr:first').addClass('alt-row');
		$tags.find("div.network-list").hide();
		$div.hide().append($tags);
		$("#view").append($div);
		$tags.find("a.tag").click(show_tag);
		$div.slideDown("fast");
	});
}

function generate_group_edit_form(settings, g, classes)
{
	var p = g ? g.permissions : {};
	var $edit_group = snippet(g ? "edit-group" : "add-group", {
		group: g ? g.name : "change me!",
		comments: g ? g.comments : "",
		group_superuser: { checked : p.superuser },
		group_view_changelog: { checked: p.view_changelog },
		group_view_usage_stats: { checked: p.view_usage_stats }
	 });
	var $by_class = $edit_group.find("table.class-permissions").find("tbody");
	$by_class.append(snippet("class-permissions", {
		"class-name": { text: "default permissions", "class": "class-name default" },
		group_range: { checked: p.range, "class": "group_range class-id-0" },
		group_net: { checked: p.net, "class": "group_net class-id-0" },
		group_ip: { checked: p.ip, "class": "group_ip class-id-0" }
	}));
	var cn = classes.length;
	for (var ci = 0; ci < cn; ci++) {
		var class_id = classes[ci].id;
		$by_class.append(snippet("class-permissions", {
			"class-name": classes[ci].name,
			group_range: { checked: p.by_class && p.by_class[class_id] ? p.by_class[class_id].range : 0,
				"class": "group_range class-id-" + class_id },
			group_net  : { checked: p.by_class && p.by_class[class_id] ? p.by_class[class_id].net   : 0,
				"class": "group_net class-id-" + class_id },
			group_ip   : { checked: p.by_class && p.by_class[class_id] ? p.by_class[class_id].ip    : 0,
				"class": "group_ip class-id-" + class_id }
		}));
	}

	$edit_group.find('.cancel-button').click(function (ev) {
		ev.preventDefault();
		ev.stopPropagation();
		var $li = $edit_group.parent();
		$li.data("shown", false);
		var $el = $li.find("a.edit-group-link");
		$el.find("span.ui-icon").removeClass("ui-icon-carat-1-n");
		$el.find("span.ui-icon").addClass("ui-icon-carat-1-e");
		$edit_group.slideUp("fast", function () { $edit_group.remove(); });
	});

	$edit_group.find('.ok-button').click(function (ev) {
		ev.preventDefault();
		ev.stopPropagation();

		var data = {};
		$edit_group.find("input").each(function () {
			var $inp = $(this);
			if ($inp.attr("type") == "checkbox" && $inp.attr("checked")) {
				var c = $inp.attr("class");
				var class_id = c.replace(/^group_\S+\s+class-id-(\d+)$/, "$1");
				if (class_id != c) {
					var perm = c.replace(/^group_(\S+)\s+class-id-\d+$/, "$1");
					data[perm + "-" + class_id] = 1;
				} else {
					var perm = c.replace(/^group_(\S+)$/, "$1");
					data[perm] = 1;
				}
			} else if ($inp.attr("type") == "text" && $inp.attr("class") == "group") {
				data["name"] = $inp.val();
			} else if ($inp.attr("type") == "text" && $inp.attr("class") == "comments") {
				data["comments"] = $inp.val();
			}
		});
		data["gid"] = g ? g.id : 0;
		data["what"] = "update-group";

		remote(data, function (gg) {
			var $li = $edit_group.parent();
			$li.data("shown", false);
			var $el = $li.find("a.edit-group-link");
			$el.find("span.ui-icon").removeClass("ui-icon-carat-1-n");
			$el.find("span.ui-icon").addClass("ui-icon-carat-1-e");
			$edit_group.slideUp("fast", function () {
				$edit_group.remove();
				if (g) {
					var $new_li = generate_group_edit_link(settings, gg, classes);
					$li.replaceWith($new_li);
					$new_li.effect("highlight", {}, 1000);
				} else {
					var $new_li = generate_group_edit_link(settings, gg, classes);
					$li.before($new_li);
					$new_li.effect("highlight", {}, 1000);
				}
				settings.groups[gg.id] = gg;
			});
		});
	});

	return $edit_group.hide();
}

function generate_group_edit_link(settings, g, classes)
{
	var $li = $('<li><a class="edit-group-link" href="#"><span class="form-icon ui-icon ui-icon-carat-1-e"></span>'
		+ (g ? g.name : "..[new group]..") + "</a></li>");
	var $el = $li.find("a.edit-group-link");
	$li.data("shown", false);
	$el.click(function(ev) {
		ev.preventDefault();
		ev.stopPropagation();
		clear_selection();
		if ($li.data("shown")) {
			$li.data("shown", false);
			$el.find("span.ui-icon").removeClass("ui-icon-carat-1-n");
			$el.find("span.ui-icon").addClass("ui-icon-carat-1-e");
			var $div = $li.find("div.edit-group");
			$div.slideUp("fast", function () { $div.remove(); });
		} else {
			$li.data("shown", true);
			$el.find("span.ui-icon").removeClass("ui-icon-carat-1-e");
			$el.find("span.ui-icon").addClass("ui-icon-carat-1-n");
			var $div = generate_group_edit_form(settings, g, classes);
			$li.append($div);
			$div.slideDown("fast");
			$div.find("input.group").focus().select();
		}
	});
	return $li;
}

function all_groups(groups, callback)
{
	var keys = [];
	var i = 0;
	for (var id in groups) {
		if (groups.hasOwnProperty(id)) {
			keys[i++] = id;
		}
	}
	var l = keys.length;
	keys.sort(function(a,b){return a-b});
	for (i = 0; i < l; i++) {
		callback(groups[keys[i]]);
	}
}

function generate_user_edit_form(settings, u)
{
	var data = {};
	data.user = u ? u.name : "change me!";
	data.group = [];
	var selected_gid = u ? u.group_id : settings.default_group;
	var i = 0;
	all_groups(settings.groups, function (g) {
		data.group[i] = { group: {
			value: g.id,
			text: g.name,
			selected: g.id == selected_gid
		}};
		i++;
	});

	var $edit_user = snippet(u ? "edit-user" : "add-user", data);
	$edit_user = $($edit_user[0].outerHTML);

	$edit_user.find('.cancel-button').click(function (ev) {
		ev.preventDefault();
		ev.stopPropagation();
		var $li = $edit_user.parent();
		$li.data("shown", false);
		var $el = $li.find("a.edit-user-link");
		$el.find("span.ui-icon").removeClass("ui-icon-carat-1-n");
		$el.find("span.ui-icon").addClass("ui-icon-carat-1-e");
		$edit_user.slideUp("fast", function () { $edit_user.remove(); });
	});

	$edit_user.find('.ok-button').click(function (ev) {
		ev.preventDefault();
		ev.stopPropagation();

		var name = u ? u.name : $edit_user.find("input.user").val();
		var gid = $edit_user.find("select.group_select option:selected").val();
		remote({ what: "update-user", user: name, group_id: gid }, function (uu) {
			var $li = $edit_user.parent();
			$li.data("shown", false);
			var $el = $li.find("a.edit-user-link");
			$el.find("span.ui-icon").removeClass("ui-icon-carat-1-n");
			$el.find("span.ui-icon").addClass("ui-icon-carat-1-e");
			$edit_user.slideUp("fast", function () {
				$edit_user.remove();
				if (u) {
					var $new_li = generate_user_edit_link(settings, uu);
					$li.replaceWith($new_li);
					$new_li.effect("highlight", {}, 1000);
				} else {
					var $new_li = generate_user_edit_link(settings, uu);
					$li.before($new_li);
					$new_li.effect("highlight", {}, 1000);
				}
			});
		});
	});

	return $edit_user.hide();
}

function generate_user_edit_link(settings, u)
{
	var $li = $('<li><a class="edit-user-link" href="#"><span class="form-icon ui-icon ui-icon-carat-1-e"></span>'
		+ (u ? u.name : "..[new user]..") + "</a>" +
		(u ? " &nbsp; <span class='user-group'>(" + settings.groups[u.group_id].name + ")</span>" : "") +
		"</li>");
	var $el = $li.find("a.edit-user-link");
	$li.data("shown", false);
	$el.click(function(ev) {
		ev.preventDefault();
		ev.stopPropagation();
		clear_selection();
		if ($li.data("shown")) {
			$li.data("shown", false);
			$el.find("span.ui-icon").removeClass("ui-icon-carat-1-n");
			$el.find("span.ui-icon").addClass("ui-icon-carat-1-e");
			var $div = $li.find("div.edit-user");
			$div.slideUp("fast", function () { $div.remove(); });
		} else {
			$li.data("shown", true);
			$el.find("span.ui-icon").removeClass("ui-icon-carat-1-e");
			$el.find("span.ui-icon").addClass("ui-icon-carat-1-n");
			var $div = generate_user_edit_form(settings, u);
			$li.append($div);
			$div.slideDown("fast");
			$div.find("input.user").focus().select();
		}
	});
	return $li;
}

function settings_view()
{
	remote({what: "fetch-settings"}, function (res) {
		var $div = $("<div class='linklist' id='main-content'></div>").hide();

		$div.append($("<h2>Group management</h2>"));
		var $group_ul = $("<ul></ul>");
		$div.append($group_ul);

		all_groups(res.groups, function (g) {
			$group_ul.append(generate_group_edit_link(res, g, res.classes));
		});
		$group_ul.append(generate_group_edit_link(res, null, res.classes));

		$div.append($("<h2>User management</h2>"));
		var $user_ul = $("<ul></ul>");
		$div.append($user_ul);

		var n = res.users.length;
		for (var i = 0; i < n; i++) {
			$user_ul.append(generate_user_edit_link(res, res.users[i]));
		}
		$user_ul.append(generate_user_edit_link(res, null));

		$("#view").append($div);
		$div.slideDown("fast");
	});
}

function show_tag(ev)
{
	var $t = $(ev.target);
	if ($t.is("a.tag")) {
		clear_selection();
		ev.preventDefault();
		ev.stopPropagation();
		var tag = $t.text();
		var $div = $t.parent().parent().find("div.network-list");
		if ($div.is(":hidden")) {
			remote({what: "networks-for-tag", tag: tag}, function (res) {
				var $tab  = $("<table class='networks'></table>");
				$div.append($tab);
				var n = res.length;
				for (var i = 0; i < n; i++) {
					$tab.append(insert_network(res[i]));
				}
				$tab.find('tr.network:nth-child(even)').addClass('alt-row');
				$div.slideDown("fast");
			});
		} else {
			$div.slideUp("fast", function () { $div.html(""); });
		}
	}
}

function stat_view()
{
	_BIGFREE = [];
	_STATS_BY_CLASS = {};
	remote({what: "top-level-nets"}, function (res) {
		var $div = $("<div class='linklist' id='main-content'></div>");
		$div.append($("<h2>IPv4 Usage Statistics (network based)</h2>"));
		var $table = $("<table class='networks'><tr><th>Supernet</th><th>Total IPs</th><th>Used IPs</th><th>Free IPs</th><th>Percent Used</th></tr></table>");
		$div.append($table);
		$("#view").append($div);
		$div.show();
		var n = res.length;
		add_stat_line($div, $table, res, 0, n, 0, 0);
	});
}

function add_stat_line($div, $table, res, i, n, all_total, all_used)
{
	if (i >= n) {
		// finalize

		$div.append($("<h2>IPv4 usage statistics (category based)</h2>"));
		var $table = $("<table class='networks'><tr><th>Category</th><th>Total IPs</th><th>Used IPs</th><th>Free IPs</th><th>Percent Used</th></tr></table>");
		for (var class_name in _STATS_BY_CLASS) {
			var $tr = $("<tr class='network'><td class='network'>" + class_name + "</td><td class='ip'>" +
				_STATS_BY_CLASS[class_name].total + "</td><td class='ip'>" +
				_STATS_BY_CLASS[class_name].used + "</td><td class='ip'>" +
				_STATS_BY_CLASS[class_name].unused + "</td><td class='ip'>" +
				(100 * _STATS_BY_CLASS[class_name].used / _STATS_BY_CLASS[class_name].total).toFixed(1) + "% </td></tr>");
			$table.append($tr);
		}
		$table.find('tr.network:nth-child(even)').addClass('alt-row');
		$div.append($table);

		$div.append(snippet("statistics-usage-summary", {
            total : all_total,
            used  : all_used,
            free  : all_total - all_used,
            usage : (100 * all_used / all_total).toFixed(1) + "%"
		}));

		$div.append($("<h2>Big IPv4 free public space</h2>"));
		var $table = $("<table class='networks'><tr><th>Size</th><th>Free nets</th></tr></table>");
		for (var k = 0; k < 24; k++) {
			if (_BIGFREE[k]) {
				$table.append(
					$("<tr class='network'><td class='network'>" +
					k + "</td><td class='ip'>" +
					_BIGFREE[k].length + "</td></tr>"));
				for (var j = 0; j < _BIGFREE[k].length; j++) {
					var $tr = $("<tr class='network class-range'><td class='network'></td><td class='ip'>" +
						"<div class='class-range'>" +
						_BIGFREE[k][j].net +
						maybe("net", null, button_icon("allocate", "plus", "Allocate network in this range")) +
						"<span class='extras-here'></span>" +
						"</div>" +
						"</td></tr>");
					$table.append($tr);
					$tr.data("@net", _BIGFREE[k][j]);
					class_range_net_link($tr);
				}
			}
		}
		$table.find('tr.network:nth-child(even)').addClass('alt-row');
		$div.append($table);
	} else {
		remote({what: "net", id: null, limit: res[i], free: true},
		function (nets) {
			var n_nets = nets.length;
			var ip_total = 0;
			var ip_used  = 0;
			var ip_free  = 0;
			for (var k = 0; k < n_nets; k++) {
				var net = nets[k];
				if (net.f == 4) {
					if (!_STATS_BY_CLASS[net.class_name]) {
						_STATS_BY_CLASS[net.class_name] = {
							total: 0,
							used: 0,
							unused: 0
						};
					}
					_STATS_BY_CLASS[net.class_name].total += net.sz;
					if (net.free == 1) {
						ip_free += net.sz;
						if (!net.private && net.bits < 25) { // a bit arbitrary
							if (!_BIGFREE[net.bits]) _BIGFREE[net.bits] = [];
							_BIGFREE[net.bits].push(net);
						}
						_STATS_BY_CLASS[net.class_name].unused += net.sz;
					} else {
						ip_used += net.sz;
						if (!net.private)	all_used += net.sz;
						_STATS_BY_CLASS[net.class_name].used += net.sz;
					}
					ip_total += net.sz;
					if (!net.private)	all_total += net.sz;
				}
			}
			if (ip_total) {
				var $tr = $("<tr class='network'><td class='network'>" + res[i] + "</td><td class='ip'>" +
					ip_total + "</td><td class='ip'>" +
					ip_used + "</td><td class='ip'>" +
					ip_free + "</td><td class='ip'>" +
					(100 * ip_used / ip_total).toFixed(1) + "% </td></tr>");
				if (net.private)
					$tr.find(".network").addClass('noteworthy').tooltip({ 
						cssClass: "tooltip",
						xOffset:  10,
						yOffset:  30,
						content:  '<a href="http://tools.ietf.org/html/'+ net.private +'">'+ net.private +'</a> range'
					});
				$table.append($tr);
				$table.find('tr.network:nth-child(even)').addClass('alt-row');
			}
			add_stat_line($div, $table, res, i+1, n, all_total, all_used);
		});
	}
}
/*
		remote({what: "net", id: null, limit: limit, free: true},
		function (res) {
			$main_a.find("span.ui-icon").removeClass("ui-icon-carat-1-e");
			$main_a.find("span.ui-icon").addClass("ui-icon-carat-1-n");
			var $div = $("<div class='linklist networks'></div>");
			var $tab  = $("<table class='networks'></table>");
			$div.hide().append($tab);
			var n = res.length;
			for (var i = 0; i < n; i++) {
				$tab.append(insert_network(res[i]));
			}
			$tab.find('tr.network:nth-child(even)').addClass('alt-row');
			$main_a.closest("li").append($div);
			$div.slideDown("fast");
			remove_net_link($li, class_range_id, limit);
		});
*/

function search()
{
	var v = $("#search").val();
	$(document).data("@search", v);
	remote({what: "search", q: v}, function (res) {
		var $div = $("<div class='linklist' id='main-content'></div>");
		$div.hide();
		if (res.n.length != 0) {
			$div.append($("<h2>Matching networks (" + res.nn +
				");  <font size='smaller'>IPv4 addresses/used/free: " +
				res.v4_size_n + "/" + res.v4_used_n + "/" + res.v4_free_n +
				"</font></h2>"));
		} else {
			$div.append($("<h2>Matching networks (" + res.nn + ")</h2>"));
		}
		network_search_results($div, res);
		$div.append($("<h2>Matching IP addresses (" + res.ni + ")</h2>"));
		ip_search_results($div, res);
		$div.append($("<h2>Matching historic networks (" + res.nhn + ")</h2>"));
		network_history_search_results($div, res);
		$div.append($("<h2>Matching historic IP addresses (" + res.nhi + ")</h2>"));
		ip_history_search_results($div, res);
		$("#view").append($div);
		$div.slideDown("fast");
	});
}

function network_search_results($div, res)
{
	if (res.n.length == 0 && !res.net_message)
		res.net_message = "No matches.";
	if (res.net_message)
		$div.append(possibly_full_search("net", res.net_message));
	var $tab  = $("<table class='networks'></table>");
	$div.append($tab);
	var n = res.n.length;
	for (var i = 0; i < n; i++) {
		$tab.append(insert_network(res.n[i]));
	}
	$tab.find('tr.network:nth-child(even)').addClass('alt-row');
}

function network_history_search_results($div, res)
{
	if (res.hn.length == 0 && !res.net_message)
		res.net_message = "No matches.";
	if (res.net_message)
		$div.append(possibly_full_search("net", res.net_message));
	var $tab  = $("<table class='networks'></table>");
	$div.append($tab);
	var n = res.hn.length;
	for (var i = 0; i < n; i++) {
		$tab.append(insert_network(res.hn[i]));
	}
	$tab.find('tr.network:nth-child(even)').addClass('alt-row');
}

function ip_search_results($div, res)
{
	if (res.i.length == 0 && !res.ip_message)
		res.ip_message = "No matches.";
	if (res.ip_message)
		$div.append(possibly_full_search("ip", res.ip_message));
	if (res.i.length == 0)
		return;
	var $ips = $("<div class='addresses'><table class='addresses'></table></div>");
	var n = res.i.length;
	var trs = "";
	for (var i = 0; i < n; i++) {
		var v = res.i[i];
		trs += "<tr class='ip-info'><td class='ip'>" +
			'<a class="show-net" href="#" title="Show network">' +
			'<span class="form-icon ui-icon ui-icon-arrowreturnthick-1-n"></span></a>' +
			"<a class='ip' href='#'>" + v.ip + "</a>" +
			"</td><td class='description'>" + ip_description(v) +
			"</td></tr>";
	}
	$ips.find("table").append(trs);
	$ips.find('tr:nth-child(even)').addClass('alt-row');
	$ips.find("table.addresses").click(edit_ip);
	$div.append($ips);
}

function ip_history_search_results($div, res)
{
	if (res.hi.length == 0 && !res.ip_message)
		res.ip_history_message = "No matches.";
	if (res.ip_history_message)
		$div.append(possibly_full_search("ip-history", res.ip_history_message));
	if (res.hi.length == 0)
		return;
	var $ips = $("<div class='addresses'><table class='addresses'></table></div>");
	var n = res.hi.length;
	var trs = "";
	for (var i = 0; i < n; i++) {
		var v = res.hi[i];
		trs += "<tr class='ip-info'><td class='ip'>" +
			'<a class="show-net" href="#" title="Show network">' +
			'<span class="form-icon ui-icon ui-icon-arrowreturnthick-1-n"></span></a>' +
			"<a class='ip' href='#'>" + v.ip + "</a>" +
			"</td><td class='description'>" + ip_description(v) +
			"</td></tr>";
	}
	$ips.find("table").append(trs);
	$ips.find('tr:nth-child(even)').addClass('alt-row');
	$ips.find("table.addresses").click(edit_ip);
	$div.append($ips);
}


function possibly_full_search(what, msg)
{
	var m = msg.replace(/{(.*?)}/, "<a class='show-anyway' href='#'>$1</a>");
	var $div = inline_alert(m);
	var v = $(document).data("@search");
	$div.find(".show-anyway").click(function (ev) {
		ev.preventDefault();
		ev.stopPropagation();
		remote({what: "search", q: v, only: what, all: true}, function (res) {
			var $new_div = $("<div class='linklist'></div>");
			$new_div.hide();
			if (what == "net")
				network_search_results($new_div, res);
			if (what == "ip")
				ip_search_results($new_div, res);
			if (what == "ip-history")
				ip_history_search_results($new_div, res);
			$div.replaceWith($new_div);
			$new_div.slideDown("fast");
		});
	});
	return $div;
}

function view_changes()
{
	var $div = snippet("change-log-div", {main:{id:"main-content"}});
	$div.data("@page", 0);
	$("#view").append($div);
	$div.slideDown("fast", function () { $("#changelog-filter").focus(); });
	$("#changelog-filter-button").click(function (ev) {
		ev.preventDefault();
		ev.stopPropagation();
		$div.data("@page", 0);
		filter_changes(true);
	});
	filter_changes();
}

function filter_changes(changed)
{
	var $div = $("#main-content");
	var filter = $("#changelog-filter").val();
	var page = $div.data("@page");
	remote({what: 'changelog', filter: filter, page: page, pagesize: _CHANGELOG_PAGE_SIZE }, function (res) {
		var $form = $("<form class='changelog-form'><table class='changelog'></table></form>");
		var $head_tr = changelog_navigation(res);
		var $tail_tr = changelog_navigation(res);
		var $tab = $form.find("table.changelog");
		$tab.append($head_tr);
		var n = res.e.length;
		for (var i = 0; i < n; i++) {
			var v = res.e[i];
			var $tr = $("<tr><td class='date'>" +
				date_format(v.created) +
				"</td><td class='who'>" + v.who +
				"</td><td class='change'>" + format_change(v) +
				"</td></tr>");
			$tr.find("td.change").data("@created", v.created);
			$tab.append($tr);
		}
		if (n == 0) {
			$tab.append($("<tr><td colspan='3'>" + inline_alert("No matching changes").html() + "</td></tr>"));
		}
		$tab.find('tr:nth-child(odd)').not('tr:first').addClass('alt-row');
		$tab.append($tail_tr);
		$tab.click(changelog_click_handler);
		$div.find("form.changelog-form").remove();
		$div.append($form);
		$form.find(".next").click(function (ev) {
			$div.data("@page", $div.data("@page")+1);
			ev.preventDefault();
			ev.stopPropagation();
			filter_changes(true);
		});
		$form.find(".previous").click(function (ev) {
			$div.data("@page", $div.data("@page")-1);
			ev.preventDefault();
			ev.stopPropagation();
			filter_changes(true);
		});
		if (changed) $form.effect("highlight", {}, 1000);
	});
}

function format_change(v)
{
	var t = v.change;
	if (v.what == 'N') {
		t = t.replace(/(\d+\.\d+\.\d+\.\d+\/\d+)/, "<a class='net-history' href='#'>$1</a>");
		t = t.replace(/([\da-fA-F]+(:[\da-fA-F]+){7}\/\d+)/, "<a class='net-history' href='#'>$1</a>");
		t = t.replace(/([\da-fA-F]+(:[\da-fA-F]+)*::\/\d+)/, "<a class='net-history' href='#'>$1</a>");
	} else if (v.what == 'I') {
		t = t.replace(/(\d+\.\d+\.\d+\.\d+)/, "<a class='ip-history' href='#'>$1</a>");
		t = t.replace(/IP ([\da-fA-F]+:([:\da-fA-F]+)*)/, "IP <a class='ip-history' href='#'>$1</a>");
	}
	return t;
}

function changelog_navigation(r)
{
	var $tr = $("<tr class='navigation'></tr>");
	var $td_left  = $("<td class='changelog left'></td>");
	var $td_right = $("<td class='changelog right'></td>");
	if (r.p > 0) {
		var $prev = $(button_icon("previous", "arrowthick-1-w", "Previous page"));
		$td_left.append($prev);
	}
	if (r.n > 0) {
		var $next = $(button_icon("next", "arrowthick-1-e", "Next page"));
		$td_right.append($next);
	}
	$tr.append($td_left);
	$tr.append($("<td></td>"));
	$tr.append($td_right);
	return $tr;
}

function changelog_click_handler(ev)
{
	var $t = $(ev.target);
	if ($t.closest("a.ip-history").length > 0) {
		var $td = $t.closest("td.change");
		var ip = $t.closest("a.ip-history").text();
		show_ip_history(ev, $td, ip, false, $td.data("@created"));
	} else if ($t.closest("a.net-history").length > 0) {
		var $td = $t.closest("td.change");
		var net = $t.closest("a.net-history").text();
		show_network_history(ev, $td, net, false, $td.data("@created"));
	}
/*
	if ($t.is("a.ip") && $t.parent().is("td.ip")) {
		ev.preventDefault();
		ev.stopPropagation();
		var $form_td = $t.parent().parent().find("td.description:first");
		var $div = $form_td.find("div.ip-net:first");
		if ($div.is("div")) {
			$div.slideUp("fast", function () { $(this).remove(); edit_ip_main($t, $form_td); });
		} else {
			edit_ip_main($t, $form_td);
		}
*/
}

function add_network($where)
{
	if (!$where && $('#add-form').length > 0) {
		$('#add-form').slideToggle("fast", function () {
			if (!$(this).is(":hidden"))
				$(this).find(".network").focus().select();
		});
	} else {
		var id_or_class = $where ? "class" : "id";
		var inside = "";
		var class_id = 0;
		var v;
		var limit = "";
		if ($where) {
			v = $where.data("@net");
			inside = " within " + v.net;
			class_id = v.class_id;
			limit = v.net;
		}
		var form = '<div ' + id_or_class + '="add-form"><form class="add-form">' +
			'<div class="edit-header">Allocating new network' +
			inside + '</div><div class="edit-form">' +
			'<table><tr><td class="label">Class:</td><td>' +
			gen_class_input(class_id, "net") + '</td></tr>' +
			'<tr><td class="label">Network:</td><td>' +
			'<input type="text" size="32" maxlength="32" class="network with-icon"/>' +
			'<a href="#" title="Suggest network based on specified size"><span class="form-icon ui-icon ui-icon-gear right suggest"></span>' +
			'</td></tr>' +
			'<tr><td class="label">Description:</td><td>' +
			'<input type="text" size="64" maxlength="256" class="network-description"/>' +
			'</td></tr>' +
			'<tr><td class="label">Tags:</td><td>' +
			'<input type="text" size="64" maxlength="256" class="network-tags"/>' +
			'</td></tr>' +
			'</table>' +
			'<table class="commands"><tr>' +
			"<td><input class='ok-button' type='image' src='images/notification_done.png' title='Save'/></br><span class='smaller'>Save</span></td>" +
			"<td><input class='cancel-button' type='image' src='images/notification_error.png' title='Cancel'/></br><span class='smaller'>Cancel</span></td>" +
			'</tr></table></div></form></div>';
		var $form = $(form);
		var $insert = $form;
		$form.hide();
		var in_class_range = false;
		if ($where)	{
			$form.find(".network").val(v.net);
			if ($where.is(".class-range")) {
				$where.find(".extras-here").after($insert);
				$form.addClass("class-range");
				in_class_range = true;
			} else {
				$insert = $("<tr><td colspan='3'></td></tr>");
				$insert.find("td").append($form);
				$where.after($insert);
			}
		} else {
			$("#view").prepend($form);
		}
		$form.slideDown("fast");
		$form.find('.cancel-button').click(function (ev) {
			ev.preventDefault();
			ev.stopPropagation();
			$form.slideUp("fast", function () {
				if ($where) {
					$insert.remove();
					if (!in_class_range) add_address_link($where);
				}
			});
		});
		if ($where && !in_class_range) {
			var $el = $where.find("a.address-link");
			$el.unbind("click");
			$el.click(function (ev) {
				$form.slideUp("fast", function () { if ($where) { $insert.remove(); }});
				ev.preventDefault();
				ev.stopPropagation();
				add_address_link($where);
			});
		}
		$form.find('.suggest').click(function (ev) {
			ev.preventDefault();
			ev.stopPropagation();
			remote({what: "suggest-network",
				limit: limit,
				sz: $form.find(".network").val(),
				id: $form.find(".network-class").val()},
				function (res) {
					if (res.n) {
						$form.find(".network").val(res.n).effect("highlight", {}, 2000);
					} else {
						carp("Internal error, should not happen!");
					}
				});
		});
		$form.find('.ok-button').click(function (ev) {
			ev.preventDefault();
			ev.stopPropagation();
			clear_selection();
			var $net = $form.find(".network");
			var $descr = $form.find(".network-description");
			var $class = $form.find(".network-class");
			var $tags = $form.find(".network-tags");
			if ($net.val() == "") {
				$net.effect("bounce", {direction: "left"});
				return carp("Network must be specified");
			}
			if ($descr.val() == "") {
				$descr.effect("bounce", {direction: "left"});
				return carp("Network description must be specified");
			}
			remote({what: "new-network",
				limit: limit,
				net: $net.val(),
				descr: $descr.val(),
				tags: $tags.val(),
				class_id: $class.val(),
				in_class_range: in_class_range},
				function (res) {
					message(res.msg);
					if ($where && !in_class_range) {
						$insert.remove();
						replace_networks($where, res);
					} else {
						var $div = $("#main-content").find("div.newly-inserted");
						var $tab;
						if ($div.length <= 0) {
							$div = $("<div class='linklist newly-inserted'></div>");
							$tab = $("<table class='networks'></table>");
							$div.hide().append($("<h2>Newly inserted networks</h2>"));
							$div.append($tab);
							$("#main-content").prepend($div);
						} else {
							$tab = $div.find("table.networks");
						}
						var $ni = insert_network(res);
						$tab.append($ni);
						$form.slideUp("fast", function () { if (in_class_range) $form.remove(); });
						if (!in_class_range) {
							$net.val("");
							$descr.val("");
							$class.val(0);
						}
						$div.slideDown("fast");
						$tab.find('tr.network').removeClass('alt-row');
						$tab.find('tr.network:nth-child(even)').addClass('alt-row');
						$ni.effect("highlight", {}, 2000);
					}
				});
		});
		$form.find(".network").focus().select();
	}
}

function add_class_range()
{
	if ($('#add-class-range-form').length > 0) {
		$('#add-class-range-form').slideUp("fast", function () { $(this).remove() });
	} else {
		var form = '<div id="add-class-range-form" class="edit-class-range"><form class="class-range-edit-form">' +
			'<div class="edit-header">Creating new class range</div><div class="edit-form">' +
			'<table><tr><td class="label">Class:</td><td>' +
			gen_class_input(0, "range") + '</td></tr>' +
			'<tr><td class="label">Class range:</td><td>' +
			'<input type="text" size="32" maxlength="32" class="class-range-range"/>' +
			'</td></tr>' +
			'<tr><td class="label">Description:</td><td>' +
			'<input type="text" size="64" maxlength="256" class="class-range-description"/>' +
			'</td></tr>' +
			'</table>' +
			'<table class="commands"><tr>' +
			"<td><input class='ok-button' type='image' src='images/notification_done.png' title='Save'/></br><span class='smaller'>Save</span></td>" +
			"<td><input class='cancel-button' type='image' src='images/notification_error.png' title='Cancel'/></br><span class='smaller'>Cancel</span></td>" +
			'</tr></table></div></form></div>';
		var $form = $(form);
		$form.hide();
		$("#view").prepend($form);
		$form.slideDown("fast");
		$form.find(".cancel-button").click(function (e) {
			e.preventDefault();
			e.stopPropagation();
			$form.slideUp("fast", function () { $form.remove(); });
		});
		$form.find(".ok-button").click(function (e) {
			e.preventDefault();
			e.stopPropagation();
			var $range = $form.find(".class-range-range");
			var $descr = $form.find(".class-range-description");
			var $cl = $form.find(".network-class");

			if (!is_net_ok($range.val())) {
				$range.effect("bounce", {direction: "left"});
				return carp("Invalid class range", $range);
			}

			remote({
				what:		"add-class-range",
				class_id:	$cl.val(),
				range:		$range.val(),
				descr:		$descr.val()
			}, function (res) {
				message(res.msg);
				var $el = $("#browse-class-" + res.class_id);
				remove_class_link($el.find('a.browse-class'), res.class_id);
				$el.find('a.browse-class').click();
				$el.effect("highlight", {}, 3000);
				$form.slideUp("fast", function () { $form.remove(); });
			});
		});
		$form.find(".class-range-range").focus().select();
	}
}

function replace_networks($where, res)
{
	var $tab = $where.closest("table.networks");
	var n = res.n.length;
	var $toins = $where;
	var collection = new Array;
	for (var i = 0; i < n; i++) {
		var $ni = insert_network(res.n[i]);
		$toins.after($ni);
		$toins = $ni;
		collection.push($ni);
	}
	$where.remove();
	$tab.find('tr.network').removeClass('alt-row');
	$tab.find('tr.network:nth-child(even)').addClass('alt-row');
	n = collection.length;
	for (var i = 0; i < n; i++) {
		collection[i].effect("highlight", {}, 2000);
	}
}

function add_class_link($el, class_id)
{
	$el.unbind("click");
	$el.click(function(ev) {
		clear_selection();
		remote({what: "class", id: class_id},
		function (res) {
			$el.find("span.ui-icon").removeClass("ui-icon-carat-1-e");
			$el.find("span.ui-icon").addClass("ui-icon-carat-1-n");
			var $div = $("<div class='linklist'></div>");
			var $ul  = $("<ul></ul>");
			$div.hide().append($ul);
			var n = res.length;
			for (var i = 0; i < n; i++) {
				var v = res[i];
				var free_space = v.addresses;
				if (v.misclassified) {
					var $li = snippet("misclassified-class-range", {
						misclassified : v.misclassified
					});
					$ul.append($li);
					$li.data("@net", v);
					add_net_link($li, { misclassified: v.misclassified, class_id: v.class_id });
					continue;
				}
				if (v.f == 6) {
					free_space = (100 * (new Number(v.addresses) / (new Number(v.addresses) + new Number(v.used)))).toFixed(1);
					if (free_space <= 0)
						free_space = (new Number(0)).toFixed(1);
					else if (free_space > 100)
						free_space = (new Number(100)).toFixed(1);
					free_space = "" + free_space + "%";
				}
				var $li = $("<li class='class-range'>" +
					"<div>" +
					// XXX this fixed width is unsatisfactory for IPv6
					// XXX maybe this <li> should be table-like
					"<a href='#' class='show-net without-free td-like' style='width: 14em;'>" +
					'<span class="form-icon ui-icon ui-icon-carat-1-e"></span>' +
					v.net + "</a>" +
					"<span class='netinfo td-like' style='width: 7em;'> " +
					"<a href='#' class='show-net with-free'>" + free_space + " free</a>" +
					"</span>" +
					'<span class="buttons td-like">' + 
					maybe("range", class_id, button_icon("edit-range", "document", "Edit range")) +
					' ' + maybe("range", class_id, button_icon("split-range", "scissors", "Split range")) +
					(v.addresses == 0 ? "" :
					' ' + maybe("net", class_id, button_icon("allocate", "plus", "Allocate network in this range"))) +
					(v.used != 0 ? "" :
					' ' + maybe("range", class_id, button_icon("delete-range", "close", "Delete this range"))) +
					(v.used == 0 ? "" :
					' ' + button_icon("export-csv", "disk", "Export CSV")) +
					"</span>" +
					'<span class="description td-like">' + v.descr +
					"</span>" +
					"<span class='extras-here'></span></div></li>");
				$ul.append($li);
				$li.data("@net", v);
				class_range_net_link($li);
				class_range_edit_link($li);
				class_range_remove_link($li);
				class_range_split_link($li);
				add_export_csv($li, v, 1);
				if (v.addresses > 0)
					$li.find("a.with-free").addClass("has-free-space");
				add_net_link($li, { class_range_id: v.id });
			}
			$el.parent().append($div);
			$div.slideDown("fast");
			remove_class_link($el, class_id);
		});
		ev.preventDefault();
		ev.stopPropagation();
	});
}

function class_range_net_link($li)
{
	$li.find(".allocate").click(function(ev) {
		ev.preventDefault();
		ev.stopPropagation();
		clear_selection();
		var $form = $li.find("div.add-form.class-range");
		if ($form.length > 0)
			$form.slideUp("fast", function () { $form.remove(); });
		else
			add_network($li);
	});
}

function class_range_edit_link($li, ev)
{
	$li.find(".edit-range").click(function(ev) {
		ev.preventDefault();
		ev.stopPropagation();
		clear_selection();
		var $form = $li.find("div.edit-class-range");
		if ($form.length > 0)
			$form.slideUp("fast", function () { $form.remove(); });
		else
			edit_class_range($li);
	});
}

function class_range_remove_link($li, ev)
{
	$li.find(".delete-range").click(function(ev) {
		ev.preventDefault();
		ev.stopPropagation();
		clear_selection();
		var v = $li.data("@net");
		ask("All information about<br/>class range " + v.net + "<br/>will be deleted!", function () {
			remote({what: "remove-class-range", id: v.id}, function (res) {
				message(res.msg);
				$li.slideUp("fast", function () { $li.remove(); });
			});
		});
	});
}

function class_range_split_link($li, ev)
{
	$li.find(".split-range").click(function(ev) {
		ev.preventDefault();
		ev.stopPropagation();
		clear_selection();
		var v = $li.data("@net");
		remote({what: "split-class-range", id: v.id}, function (res) {
			var msg = "<p>Class range <strong>" + res.o + "</strong> will be split into the following:</p><p class='netlist'>";
			var n = res.n.length;
			for (var i = 0; i < n; i++) {
				var vv = res.n[i];
				msg += vv + "<br/>";
			}
			msg += "</p><p>Are you sure you want to proceed?</p>";

			ask(msg, function () {
				remote({what: "split-class-range", id: v.id, confirmed: 0}, function (res) {
					message(res.msg);
					$li.slideUp("fast", function () { $li.remove(); });
				});
			});
		});
	});
}

function edit_class_range($li)
{
	var v = $li.data("@net");
	var form = '<div class="edit-class-range"><form class="class-range-edit-form">' +
		'<div class="edit-header">Editing class range ' + v.net + '</div><div class="edit-form">' +
		'<table><tr><td class="label">Class:</td><td>' +
		gen_class_input(v.class_id, "range") + '</td></tr><tr><td class="label">Description:</td><td>' +
		'<input type="text" size="64" maxlength="256" class="class-range-description"/>' +
		'</td></tr></table>' +
		'<table class="commands"><tr>' +
		"<td><input class='ok-button' type='image' src='images/notification_done.png' title='Save'/></br><span class='smaller'>Save</span></td>" +
		"<td><input class='cancel-button' type='image' src='images/notification_error.png' title='Cancel'/></br><span class='smaller'>Cancel</span></td>" +
		'</tr></table></div></form></div>';
	var $form = $(form);
	$form.hide();
	$form.find(".class-range-description").val(v.descr);
	$li.find(".extras-here").after($form);
	$form.slideDown("fast", function () {
		$form.find(".class-range-description").focus().select();
	});
	$form.find(".cancel-button").click(function (e) {
		e.preventDefault();
		e.stopPropagation();
		$form.slideUp("fast", function () { $form.remove(); });
	});
	$form.find(".ok-button").click(function (e) {
		e.preventDefault();
		e.stopPropagation();
		var $descr = $form.find(".class-range-description");
		var $cl = $form.find(".network-class");
		var v = $li.data("@net");

		remote({
			what:		"edit-class-range",
			id:			v.id,
			class_id:	$cl.val(),
			descr:		$descr.val()
		}, function (res) {
			message(res.msg);
			$li.find("span.description").text(res.descr);
			$form.slideUp("fast", function () { $form.remove(); });
			$li.effect("highlight", {}, 3000);
		});
	});
}

function remove_class_link($el, class_id)
{
	$el.unbind("click");
	$el.click(function (ev) {
		$el.find("span.ui-icon").removeClass("ui-icon-carat-1-n");
		$el.find("span.ui-icon").addClass("ui-icon-carat-1-e");
		$el.parent().find("div").slideUp("fast", function () { $(this).remove() });
		ev.preventDefault();
		ev.stopPropagation();
		clear_selection();
		add_class_link($el, class_id);
	});
}

function add_net_link($li, p)
{
	var $all_a = $li.find("a.show-net");
	var $main_a = $li.find("a.show-net.without-free");
	$all_a.unbind("click");
	$all_a.click(function(ev) {
		clear_selection();
		remote({what: "net",
			id:            p.class_range_id,
			limit:         p.limit,
			free:          $(ev.target).closest(".with-free").length > 0,
			misclassified: p.misclassified,
			class_id:      p.class_id
		},
		function (res) {
			$main_a.find("span.ui-icon").removeClass("ui-icon-carat-1-e");
			$main_a.find("span.ui-icon").addClass("ui-icon-carat-1-n");
			var $div = $("<div class='linklist networks'></div>");
			var $tab  = $("<table class='networks'></table>");
			$div.hide().append($tab);
			var n = res.length;
			for (var i = 0; i < n; i++) {
				$tab.append(insert_network(res[i]));
			}
			$tab.find('tr.network:nth-child(even)').addClass('alt-row');
			$main_a.closest("li").append($div);
			$div.slideDown("fast");
			remove_net_link($li, p);
		});
		ev.preventDefault();
		ev.stopPropagation();
	});
}

function insert_network(v)
{
	var $ni;
	if (v.free == 1) {
		$ni = $("<tr class='free network can-select'><td class='network'>" +
			"<form class='button-form'>" +
			'<span class="form-icon no-icon"></span> ' +
			'<span>' +
			"<a class='newnet-link address-link' href='#'>" + v.net + "</a>" +
			"</span></form></td><td class='class_name'>" +
			"<span class='netinfo class_name'> " + v.class_name + "</span>" +
			"</td><td class='description'>" +
			"<span class='netinfo'>" + linkify(v.descr) + "</span></td></tr>");
	} else {
		var extra = "";
		if (v.f == 4 && (v.used || v.unused)) {
			extra = "<span class='usage_stats'>" + v.sz + "/" + v.used + "/" + v.unused + "</span>&nbsp;&nbsp;";
		}
		ni = "<tr class='network can-select'><td class='network'>" +
			"<form class='button-form'>" +
			maybe("net", v.class_id, '<a class="edit-button" href="#" title="Edit"><span class="form-icon ui-icon ui-icon-document"></span></a> ') +
			'<span>';
		if (v.historic == 1) {
			ni = ni + v.net;
		} else {
			ni = ni + "<a class='address-link' href='#'>" + v.net + "</a>";
		}
		ni = ni + "</span></form></td><td class='class_name'>" + extra +
			"<span class='netinfo class_name'> " + v.class_name + "</span>" +
			"</td><td class='description'>" +
			"<span class='netinfo'>" + linkify(v.descr) + "</span></td></tr>";
		$ni = $(ni);
	}
	if (v.wrong_class == 1) {
		$ni.find("span.class_name").addClass("noteworthy").tooltip({ 
			cssClass: "tooltip",
			xOffset:  10,
			yOffset:  30,
			content:  'Classified differently<br/>from its parent range,<br/><u><strong>' +
				id2class(v.parent_class_id) + '</strong></u>'
		});
	}
	clear_selection();
	$ni.data("@net", v).find(".edit-button").click(function(ev){edit_network($ni, ev)});
	if (v.historic !== 1) {
		add_address_link($ni);
	}
	return $ni;
}

function remove_net_link($li, p)
{
	var $all_a = $li.find("a.show-net");
	var $main_a = $li.find("a.show-net.without-free");
	$all_a.unbind("click");
	$all_a.click(function (ev) {
		$main_a.find("span.ui-icon").removeClass("ui-icon-carat-1-n");
		$main_a.find("span.ui-icon").addClass("ui-icon-carat-1-e");
		$main_a.closest("li").find("div.networks").slideUp("fast", function () { $(this).remove() });
		ev.preventDefault();
		ev.stopPropagation();
		clear_selection();
		add_net_link($li, p);
	});
}

function add_address_link($li)
{
	var v = $li.data("@net");
	var $el = $li.find("a.address-link");
	$el.unbind("click");
	clear_selection();
	if (v.free == 1) {
		$el.click(function(ev) {
			ev.preventDefault();
			ev.stopPropagation();
			add_network($li);
		});
	} else {
		$el.click(function(ev) {
			no_click_action($el);
			ev.preventDefault();
			ev.stopPropagation();
			if (v.f == 6) {
				remote({what: "addresses", net: v.net}, function (ips) {
					var n = ips.length;
					for (var i = 0; i < n; i++) {
						ips[i].description = ip_description(ips[i]);
						ips[i].ip_address = ips[i].ip;
						delete ips[i].ip;
					}
					var $pages = snippet("ipv6-address-list", { ips: ips });
					$pages.find('a.new').data("@net", v);
					$pages.find('tr.ip-info:nth-child(even)').addClass('alt-row');
					$li.after($pages);
					$li.data("$pages", $pages);
					$pages.find("table.addresses").unbind("click").click(edit_ip);
					$pages.find("div.address-list").slideDown("fast");
					remove_address_link($li, $pages);
				});
			} else {
				remote({what: "paginate", net: v.net}, function (res) {
					var $pages = gen_address_pages(v, res);
					$pages.find("div.address-list").hide();
					$li.after($pages);
					$li.data("$pages", $pages);
					$pages.find("div.address-list").slideDown("fast");
					remove_address_link($li, $pages);
				});
			}
		});
	}
}

function remove_address_link($li, $pages)
{
	var $el = $li.find("a.address-link");
	$el.unbind("click");
	$el.click(function (ev) {
		clear_selection();
		$pages.find("div.address-list").slideUp("fast", function () { $pages.remove() });
		ev.preventDefault();
		ev.stopPropagation();
		add_address_link($li);
	});
}

function edit_network($li, ev)
{
	clear_selection();
	ev.preventDefault();
	ev.stopPropagation();
	var $edit_icon = $(ev.target);
	$edit_icon.unbind("click");
	var v = $li.data("@net");
	var form = '<tr><td colspan="3"><div class="network-edit"><form class="network-edit-form">' +
		'<div class="edit-header">Editing network ' + v.net + '</div><div class="edit-form">' +
		'<table><tr><td class="label">Class:</td><td>' +
		gen_class_input(v.class_id, "net") + '</td></tr><tr><td class="label">Description:</td><td>' +
		'<input type="text" size="64" maxlength="256" class="network-description"/>' +
		'</td></tr>' + 
		'<tr><td class="label">Tags:</td><td>' +
		'<input type="text" size="64" maxlength="256" class="network-tags"/>' +
		'</td></tr>' +
		'</table>' +
		'<table class="commands"><tr>' +
		"<td><input class='ok-button' type='image' src='images/notification_done.png' title='Save'/></br><span class='smaller'>Save</span></td>" +
		"<td><input class='cancel-button' type='image' src='images/notification_error.png' title='Cancel'/></br><span class='smaller'>Cancel</span></td>" +
		"<td>&nbsp;&nbsp;</td>" +
		"<td><input class='history-button' type='image' src='images/clock.png' title='History'/></br><span class='smaller'>History</span></td>" +
		"<td>&nbsp;&nbsp;</td>" +
		maybe("net", v.class_id, "<td><input class='remove-button' type='image' src='images/notification_remove.png' title='Remove'/></br><span class='smaller'>Remove</span></td>");
	if (v.merge_with && can("net", v.class_id))
		form += "<td>&nbsp;&nbsp;</td>" +
		"<td><input class='merge-button' type='image' src='images/load_download.png' title='Merge with " +
		v.merge_with + "'/></br><span class='smaller'>Merge</span></td>";
	form += '</tr></table></div></form></div></td></tr>';
	var $form = $(form);
	$form.find("div.edit-header").hide();
	$form.find(".network-description").val(v.descr);
	$form.find(".network-tags").val(v.tags);
	// $li.find(".button-form").after($form);
	$li.after($form);
	$form.find("div.edit-header").slideDown("fast", function () {
		$form.find(".network-description").focus().select();
	});
	$li.data("$form", $form);
	var remove_form = function(e2) {
		e2.preventDefault();
		e2.stopPropagation();
		$edit_icon.unbind("click");
		$form.find("div.edit-header").slideUp("fast", function() { $form.remove(); });
		$edit_icon.click(function(ev){edit_network($li, ev)});
	}
	$(ev.target).click(remove_form);
	$form.find(".cancel-button").click(remove_form);
	$form.find(".ok-button").click(function (e) { submit_edit_network(e, $li, $form); });
	$form.find(".history-button").click(function(e) { show_network_history(e, $form.find("div.network-edit"), $li.data("@net").net, true); });
	$form.find(".remove-button").click(function(e) { submit_remove_network(e, $li, $form); });
	$form.find(".merge-button").click(function(e) { submit_merge_network(e, $li, $form); });
}

function gen_class_input(selected_id, kind)
{
	var r = "<select class='network-class'>";
	var res = $(document).data("@classes");
	var n = res.length;
	for (var i = 0; i < n; i++) {
		var v = res[i];

		if (!can(kind, v.id))
			continue;

		var o = '<option value="' + v.id + '"';
		if (v.id == selected_id) o += ' selected';
		o += '>' + v.name + '</option>';
		r += o;
	}
	return r + "</select>";
}

function id2class(id)
{
	var cl = $(document).data("@classes");
	var n = cl.length;
	for (var i = 0; i < n; i++) {
		if (cl[i].id == id)
			return cl[i].name;
	}
	return "???";
}

function gen_address_pages(ni, res)
{
	var $pages = $("<tr><td colspan='3'>" +
		"<div class='address-list'>" +
		"<table class='address-pages address-pages-top'></table>" +
		"<div class='addresses'></div>" +
		"<table class='address-pages address-pages-bottom'></table>" +
		"</div></td></tr>");
	var $tr;
	var n = res.length;
	var $fa;
	for (var i = 0; i < n; i++) {
		var v = res[i];
		if (i % 8 == 0)
			$tr = $("<tr></tr>");
		var $td = $("<td><a href='#' class='address-range'>" + v.base + "-" + v.last + "</a></td>");
		if (i == 0) $fa = $td.find("a");
		add_address_page_switch_link($pages, $td.find("a"), v.base + "/" + v.bits, v.base + "-" + v.last);
		$tr.append($td);
		if (i % 8 == 7 || i == n-1) {
			if (i / 8. <= 1) {
				var buttons = "<td valign='top'>";
				if (_SERVER_CAPS.split)
					buttons += maybe("net", ni.class_id, button_icon("clip-mode", "scissors", "Split mode"));
				if (_SERVER_CAPS.edit_range)
					buttons += button_icon("edit-range", "copy", "Edit range of IPs"); /* XXX maybe what? */
				if (_SERVER_CAPS.edit_range_list)
					buttons += button_icon("edit-range-list", "script", "Fill-in range of IPs from a list"); /* XXX maybe what? */
				if (_SERVER_CAPS.ipexport)
					buttons += button_icon("export-csv", "disk", "Export CSV");
				buttons += '</td>';
				$tr.append($(buttons));
			} else {
				$tr.append($("<td></td>"));
			}
			$pages.find("table.address-pages-top").append($tr);
			$pages.find("table.address-pages-bottom").append($tr.clone(true));
		}
	}
	$pages.find(".clip-mode").data("clip-mode", false);
	add_split_mode_link($pages);
	add_edit_range($pages, ni);
	add_edit_range_list($pages, ni);
	add_export_csv($pages, ni);
	show_addresses($pages, res[0].base + "/" + res[0].bits, res[0].base + "-" + res[0].last);
	return $pages;
}

function add_address_page_switch_link($pages, $a, net, range)
{
	$a.click(function(e) {
		e.preventDefault();
		e.stopPropagation();
		show_addresses($pages, net, range);
	});
}

function add_edit_range($pages, ni)
{
	$pages.find(".edit-range").click(function (ev) {
		clear_selection();
		ev.preventDefault();
		ev.stopPropagation();
		var $form = $pages.find(".edit-range-form");
		if ($form.length > 0) {
			$form.slideUp("fast", function () { $form.remove(); });
			return;
		}
		$form = $('<div class="edit-range-form"><form>' +
			'<div class="edit-header">Editing range of IPs within ' + ni.net + '</div>' +
			'<div class="edit-form">' +
			'<table>' +
			'<tr><td class="label">Range start:</td><td>' + 
			'<input type="text" size="16" maxlength="256" class="ip_start"/></td></tr>' +
			'<tr><td class="label">Range end:</td><td>' + 
			'<input type="text" size="16" maxlength="256" class="ip_end"/></td></tr>' +
			'<tr><td class="info" colspan="2">' +
			'In the following fields you can designate parts of the text<br/>' +
			'that will undergo autoincrementing by using the <strong>"[[]]"</strong> construct,<br/>' +
			'for example: <strong>somehost[[010]].somedomain.com</strong> will become<br/>' +
			'somehost<strong>010</strong>.somedomain.com, somehost<strong>011</strong>.somedomain.com etc.' +
			'</td></tr>' + 
			'<tr><td class="label">Description:</td><td>' + 
			'<input type="text" size="64" maxlength="256" class="ip-description"/></td></tr>' +
			'<tr><td class="label">Hostname:</td><td>' + 
			'<input type="text" size="60" maxlength="256" class="ip-hostname"/></td></tr>' +
			'<tr><td class="label">Location:</td><td>' + 
			'<input type="text" size="32" maxlength="256" class="ip-location"/></td></tr>' +
			'<tr><td class="label">Contact phone:</td><td>' + 
			'<input type="text" size="16" maxlength="256" class="ip-phone"/></td></tr>' +
			'<tr><td class="label">Owner/responsible:</td><td>' + 
			'<input type="text" size="32" maxlength="256" class="ip-owner"/></td></tr>' +
			'<tr><td class="label">Comments:</td><td>' + 
			'<textarea rows=6 cols=64 class="ip-comments"></textarea></td></tr>' +
			'</table>' +
			'<table class="commands"><tr>' +
			"<td><input class='ok-button' type='image' src='images/notification_done.png' title='Save'/></br><span class='smaller'>Save</span></td>" +
			"<td><input class='cancel-button' type='image' src='images/notification_error.png' title='Cancel'/></br><span class='smaller'>Cancel</span></td>" +
			"<td>&nbsp;&nbsp;</td>" +
			"<td><input class='remove-button' type='image' src='images/notification_remove.png' title='Remove'/></br><span class='smaller'>Remove</span></td>" +
			'</tr></table></div>' +
			'</form></div>');
		$form.hide();
		$form.find(".ip_start").val(ni.second);
		$form.find(".ip_end").val(ni.next_to_last);
		$pages.find(".address-list").prepend($form);
		$form.slideDown("fast", function () {
			$form.find(".ip_start").focus().select();
		});
		$form.find(".cancel-button").click(function (e) {
			e.preventDefault();
			e.stopPropagation();
			$form.slideUp("fast", function () { $(this).remove() });
		});
		$form.find(".ok-button").click(function (e) { submit_edit_ip_range(e, $form); });
		$form.find(".remove-button").click(function(e) { submit_remove_ip_range(e, $form); });
	});
}

function add_edit_range_list($pages, ni)
{
	$pages.find(".edit-range-list").click(function (ev) {
		clear_selection();
		ev.preventDefault();
		ev.stopPropagation();
		var $form = $pages.find(".edit-range-form");
		if ($form.length > 0) {
			$form.slideUp("fast", function () { $form.remove(); });
			return;
		}
		$form = snippet("edit-range-list-dialog", {
			net     : ni.net,
			ip_start: ni.second,
			ip_end  : ni.next_to_last
		}).hide();
		$pages.find(".address-list").prepend($form);
		$form.slideDown("fast", function () {
			$form.find(".ip_start").focus().select();
		});
		$form.find(".cancel-button").click(function (e) {
			e.preventDefault();
			e.stopPropagation();
			$form.slideUp("fast", function () { $(this).remove() });
		});
		$form.find(".ok-button").click(function (e) { submit_edit_ip_range_list(e, $form); });
	});
}

function add_export_csv($pages, ni, range, with_free)
{
	$pages.find(".export-csv").click(function (ev) {
		clear_selection();
		ev.preventDefault();
		ev.stopPropagation();
		export_csv_dialog(ni, range, with_free);
	});
}

function export_csv_dialog(ni, range, with_free)
{
	var columns = {
		C:	"Network class",
		D:	"Network description",
		H:	"Hostname/description",
		N:	"Network",
		d:	"Description",
		h:	"Hostname",
		i:	"IP Address",
		l:	"Location",
		o:	"Owner/responsible",
		p:	"Phone",
		B:	"Network base",
		M:	"Network mask",
		S:  "Network bits",
		"3":"Network /bits"
	};
	var all = "iHhdpolNDCBMS3";
	var reverse = {};
	for (var c in columns) {
		reverse[columns[c]] = c;
	}
	var ipexport = $.cookies.get("ipexport");
	if (!ipexport)	ipexport = "iH";
	if (ipexport.match(/[^CDHNdhilopBMS3]/)) // validate
		ipexport = "iH";
	var active = [];
	var inactive = [];
	var act = {};
	var splitexport = ipexport.split("");
	var splitall    = all.split("");
	for (var c = 0; c < splitexport.length; c++) {
		active[active.length] =
			{name: columns[splitexport[c]]};
		act[splitexport[c]] = true;
	}
	for (var c = 0; c < splitall.length; c++) {
		if (act[splitall[c]])	continue;
		inactive[inactive.length] = 
			{name: columns[splitall[c]]};
	}
	var $dialog = snippet("export-csv-dialog", {
		'export-csv-form': {title: "Export " + ni.net + " as CSV"},
		active_columns: active,
		inactive_columns: inactive
	});
	var save_columns = function () {
		var $els = $dialog.find("ul.included").find("li.name");
		ipexport = "";
		for (var i = 0; i < $els.length; i++) {
			if (reverse[$($els[i]).text()])
				ipexport += reverse[$($els[i]).text()];
		}
		var d = new Date();
		d.setFullYear(d.getFullYear() + 2);
		$.cookies.set("ipexport", ipexport, { expiresAt: d });
	};
	$dialog.find(".connectedSortable").sortable({
		connectWith: ".connectedSortable",
		items: 'li.name',
		update: function (ev,ui) {
			$dialog.find("ul.included").find("li.name").
				addClass("ui-state-highlight").removeClass("ui-state-default");
			$dialog.find("ul.excluded").find("li.name").
				removeClass("ui-state-highlight").addClass("ui-state-default");
			save_columns();
		}
	}).disableSelection();
	var extra = "";
	if (range) {
		extra += "&range=1";
	}
	if (with_free) {
		extra += "&with_free=1";
	}
	$dialog.dialog({
		autoOpen:	true,
		modal:		true,
		width:		400,
		buttons:	{
			Ok: function () {
				var ignore_ip = $dialog.find(".ignore_ip").attr("checked");
				ignore_ip = ignore_ip ? 1 : 0;
				$(this).dialog('close');
				var d = new Date();
				window.open(_URL + "?ipexport=" + ni.net +
					extra + "&ignore_ip=" + ignore_ip +
					"&when=" + d.valueOf(), "ipexport" );
			},
			Cancel: function () { $(this).dialog('close'); }}
	});
}

function submit_edit_ip_range(ev, $form)
{
	e.preventDefault();
	e.stopPropagation();

	var $descr    = $form.find(".ip-description");
	var $hostname = $form.find(".ip-hostname");
	var $location = $form.find(".ip-location");
	var $phone    = $form.find(".ip-phone");
	var $owner    = $form.find(".ip-owner");
	var $comments = $form.find(".ip-comments");

	if ($descr.val() == "" && $hostname.val() == "") {
		$descr.effect("bounce", {direction: "left"});
		$hostname.effect("bounce", {direction: "left"});
		return carp("Either a description or a hostname or both must be given", $descr);
	}
	var ip = $form.data("@ip");

	remote({
		what:		"edit-ip",
		ip:			ip,
		descr:		$descr.val(),
		hostname:	$hostname.val(),
		location:	$location.val(),
		phone:		$phone.val(),
		owner:		$owner.val(),
		comments:	$comments.val()
	}, function (res) {
		message(res.msg);
		var $tr = $form.closest("tr.ip-info");
		var $descr = $form.closest("td.description");
		$form.slideUp("fast", function () {
			$(this).remove();
			$descr.html(ip_description(res));
			$tr.effect("highlight", {}, 3000);
		});
	});
}

function submit_remove_ip_range(ev, $form)
{
}

function submit_edit_ip_range_list(ev, $form)
{
}

function add_split_mode_link($pages)
{
	$pages.find(".clip-mode").data("clip-mode", false).click(function(ev) {
		clear_selection();
		ev.preventDefault();
		ev.stopPropagation();
		var clip_mode = $pages.find(".clip-mode").data("clip-mode");
		$pages.find(".clip-mode").data("clip-mode", !clip_mode);
		set_clip_mode($pages);
	});
}

function set_clip_mode($pages)
{
	var $tr = $pages.find("table.addresses tr").filter(function() {
		var $tr = $(this);
		var $td = $tr.find("td.ip");
		if ($td.length < 1)
			return false;
		var $a = $td.find("a.ip");
		if ($a.length < 1)
			return false;
		return true;
	});
	var clip_mode = $pages.find(".clip-mode").data("clip-mode");
	if (clip_mode) {
		$tr.find("td.ip").prepend($('<a class="clip-here" href="#" title="Split net here">' +
			'<span class="form-icon ui-icon ui-icon-scissors"></span></a>'));
		$tr.find(".clip-here").click(function(e) {
			e.preventDefault();
			e.stopPropagation();
			var ip = $(e.target).closest("td.ip").find("a.ip").text();
			remote({what: "split", ip: ip}, function (res) {
				var msg = "<p>Network <strong>" + res.o + "</strong> will be split into the following:</p><p class='netlist'>";
				var n = res.n.length;
				for (var i = 0; i < n; i++) {
					var v = res.n[i];
					msg += v + "<br/>";
				}
				msg += "</p><p>Are you sure you want to proceed?</p>";
				if (res.extra_msg != "")
					msg += inline_alert(res.extra_msg).html();
				ask(msg, function () {
					remote({what: "split", ip: ip, confirmed: 1}, function (res) {
						message(res.msg);
						var $tr = $pages.prev("tr.network");
						$pages.remove();
						replace_networks($tr, res);
					});
				});
			});
		});
	} else {
		$tr.find(".clip-here").remove();
	}
}

function show_addresses($pages, net, range)
{
	var $div = $pages.find("div.addresses");
	remote({what: "addresses", net: net}, function (res) {
		var $new_div = $("<div class='addresses'><table class='addresses'></table></div>");
		var n = res.length;
		for (var i = 0; i < n; i++) {
			var v = res[i];
			var $tr = $("<tr class='ip-info'><td class='ip'><a class='ip' href='#'>" + v.ip +
				"</a></td><td class='description'>" + ip_description(v) +
				"</td></tr>");
			$new_div.find("table").append($tr);
		}
		$new_div.find('tr:nth-child(even)').addClass('alt-row');
		$div.replaceWith($new_div);
		$pages.find("table.address-pages").find("td").removeClass("selected");
		$pages.find("table.addresses").unbind("click").click(edit_ip);
		$pages.find("a.address-range:contains('" + range + "')").parent().addClass("selected");
		set_clip_mode($pages);
	});
}

function edit_ip(ev)
{
	var $t = $(ev.target);
	if ($t.is("a.ip") && $t.parent().is("td.ip")) {
		clear_selection();
		ev.preventDefault();
		ev.stopPropagation();
		var $form_td = $t.parent().parent().find("td.description:first");
		var $div = $form_td.find("div.ip-net:first");
		if ($div.is("div")) {
			$div.slideUp("fast", function () { $(this).remove(); edit_ip_main($t, $form_td); });
		} else {
			edit_ip_main($t, $form_td);
		}
	} else if (($t.is("a.show-net") && $t.parent().is("td.ip")) ||
			   ($t.parent().is("a.show-net") && $t.parent().parent().is("td.ip"))) {
		clear_selection();
		ev.preventDefault();
		ev.stopPropagation();

		if (!$t.is("a.show-net"))
			$t = $t.parent();
		var ip = $t.parent().parent().find("a.ip").text();
		var $form_td = $t.parent().parent().find("td.description");
		var $div = $form_td.find("div.ip-edit");
		if ($div.is("div")) {
			$div.slideUp("fast", function () { $(this).remove() });
		}
		$div = $form_td.find("div.ip-net");
		if ($div.is("div")) {
			$div.slideUp("fast", function () { $(this).remove() });
		} else {
			remote({what: "ip-net", ip: ip},
			function (res) {
				var $div = $("<div class='ip-net'></div>");
				var $tab  = $("<table class='networks'></table>");
				$div.hide().append($tab);
				$tab.append(insert_network(res));
				$tab.find('tr.network:nth-child(even)').addClass('alt-row');
				$form_td.append($div);
				$div.slideDown("fast");
			});
		}
	}
}

function edit_ip_main($t, $form_td)
{
	var $div = $form_td.find("div.ip-edit:first");
	if ($div.is("div")) {  // XXX must be a better way!
		$div.slideUp("fast", function () { $(this).remove() });
	} else {
		var ip = $t.text();
		var new_allocation = $t.hasClass("new");
		var net;
		var within;
		if (new_allocation) {
			net = $t.data("@net");
			ip = net.first;
			within = net.net;
		}
		var $form = snippet(new_allocation ? 'ip-create-dialog' : 'ip-edit-dialog', { ip : ip, within: within }).hide();
		$form.data("@ip", ip);
		if (!new_allocation) fetch_ip_info($form, ip);
		$form_td.append($form);
		$form.slideDown("fast", function () {
			if (new_allocation)
				$form.find(".ip").focus().select();
			else
				$form.find(".ip-description").focus().select();
		});
		$form.find(".cancel-button").click(function (e) {
			e.preventDefault();
			e.stopPropagation();
			$form.slideUp("fast", function () { $(this).remove() });
		});
		$form.find(".ok-button").click(function (e) {
			var ip = new_allocation ? $form.find(".ip").val() : $form.data("@ip");
			$form.data("@ip", ip);
			submit_edit_ip(e, $form, within);
		});
		$form.find(".history-button").click(function(e) {
			var ip = new_allocation ? $form.find(".ip").val() : $form.data("@ip");
			$form.data("@ip", ip);
			show_ip_history(e, $form, $form.data("@ip"), true);
		});
		$form.find(".remove-button").click(function(e) {
			var ip = new_allocation ? $form.find(".ip").val() : $form.data("@ip");
			$form.data("@ip", ip);
			submit_remove_ip(e, $form);
		});
		$form.find('.nslookup').click(function (ev) {
			ev.preventDefault();
			ev.stopPropagation();
			var ip = new_allocation ? $form.find(".ip").val() : $form.data("@ip");
			remote({what: "nslookup", ip: ip}, function (res) {
				$form.find(".ip-hostname").val(res.host).effect("highlight", {}, 2000);
			});
		});
	}
}

function submit_edit_ip(e, $form, containing_net)
{
	e.preventDefault();
	e.stopPropagation();

	var $descr    = $form.find(".ip-description");
	var $hostname = $form.find(".ip-hostname");
	var $location = $form.find(".ip-location");
	var $phone    = $form.find(".ip-phone");
	var $owner    = $form.find(".ip-owner");
	var $comments = $form.find(".ip-comments");

	if ($descr.val() == "" && $hostname.val() == "") {
		$descr.effect("bounce", {direction: "left"});
		$hostname.effect("bounce", {direction: "left"});
		return carp("Either a description or a hostname or both must be given", $descr);
	}
	var ip = $form.data("@ip");

	remote({
		what:			"edit-ip",
		ip:				ip,
		containing_net:	containing_net,
		only_new:		containing_net, // do not overwrite old when allocating new
		descr:			$descr.val(),
		hostname:		$hostname.val(),
		location:		$location.val(),
		phone:			$phone.val(),
		owner:			$owner.val(),
		comments:		$comments.val()
	}, function (res) {
		message(res.msg);
		if (containing_net) {
			var $newline = snippet("ipv6-address-line", { ip_address: res.ip, description: ip_description(res) });
			var $tr = $form.closest("tr.ip-info");
			$tr.after($newline);
			$form.slideUp("fast", function () {
				$(this).remove();
				$newline.effect("highlight", {}, 3000);
			});
		} else {
			var $tr = $form.closest("tr.ip-info");
			var $descr = $form.closest("td.description");
			$form.slideUp("fast", function () {
				$(this).remove();
				$descr.html(ip_description(res));
				$tr.effect("highlight", {}, 3000);
			});
		}
	});
}

function submit_remove_ip(e, $form)
{
	e.preventDefault();
	e.stopPropagation();

	var ip = $form.data("@ip");
	ask("All information about<br/>IP address " + ip + "<br/>will be deleted!",
		function () {
			remote({
				what:		"edit-ip",
				ip:			ip,
				descr:		"",
				hostname:	"",
				location:	"",
				phone:		"",
				owner:		"",
				comments:	""
			}, function (res) {
				message(res.msg);
				var $tr = $form.closest("tr.ip-info");
				var $descr = $form.closest("td.description");
				$form.slideUp("fast", function () {
					$(this).remove();
					$descr.html(ip_description(res));
					$tr.effect("highlight", {}, 3000);
				});
			});
	});
}

function submit_remove_network(e, $li, $form)
{
	e.preventDefault();
	e.stopPropagation();

	var v = $li.data("@net");
	ask("All information about<br/>network " + v.net + "<br/>and IP addresses associated" +
		"<br/>with it will be deleted!",
		function () {
			remote({
				what:		"remove-net",
				id:			v.id
			}, function (res) {
				message(res.msg);
				$form.remove();
				var $pages = $li.next('tr');
				if ($pages.find("div.address-list").length > 0) {
					$pages.find("div.address-list").slideUp("fast", function () { $pages.remove() });
				}
				$li.remove();
			});
		});
}

function show_ip_history(e, $form, ip, with_fill_in, special_date)
{
	e.preventDefault();
	e.stopPropagation();
	var $hist = $form.find("div.history");
	if ($hist.length > 0) {
		$hist.slideUp("fast", function () { $(this).remove() });
	} else {
		remote({ what: "ip-history", ip: ip }, function (res) {
			var $history = $("<div class='history ip-history'><table class='history'>" +
				"<tr><th>From</th><th>Until</th><th>Description</th>" +
				"<th>Who</th><th></th></tr></table></div>");
			var $tab = $history.find("table.history");
			var fill_in = "";
			if (with_fill_in) {
				fill_in = '<a class="fill-in" href="#" title="Use this info">' +
					'<span class="form-icon ui-icon ui-icon-copy"></span></a>';
			}
			var n = res.length;
			for (var i = 0; i < n; i++) {
				var v = res[i];
				var $tr = $(
					"<tr><td class='date'>" + date_format(v.created) +
					"</td><td class='date'>" + date_format(v.invalidated, "still valid") +
					"</td><td class='description'>" + ip_description(v) +
					"</td><td class='who'>" + v.created_by +
					"</td><td class='actions'>" + fill_in +
					"</td></tr>");
				if (special_date && special_date >= v.created && special_date - v.created <= 2)
					$tr.addClass("special");
				if (with_fill_in)
					$tr.find("a.fill-in").data("@ip", v).click(function (e) {
						e.preventDefault();
						e.stopPropagation();
						var $a = $(e.target).closest("a.fill-in");
						var ip = $a.data("@ip");
						$form.effect("highlight", {}, 1000);
						$form.find(".ip-description").val(ip.descr);
						$form.find(".ip-hostname").val(ip.hostname);
						$form.find(".ip-location").val(ip.location);
						$form.find(".ip-phone").val(ip.phone);
						$form.find(".ip-owner").val(ip.owner);
						$form.find(".ip-comments").val(ip.comments);
					});
				$tab.append($tr);
			}
			$history.hide();
			$history.find('tr:nth-child(odd)').not('tr:first').addClass('alt-row');
			$form.append($history);
			$history.slideDown("fast");
		});
	}
}

function fetch_ip_info($form, ip)
{
	remote({what: "get-ip", ip: ip}, function (v) {
		$form.find(".ip").val(v.ip);
		$form.find(".ip-description").val(v.descr);
		$form.find(".ip-hostname").val(v.hostname);
		$form.find(".ip-location").val(v.location);
		$form.find(".ip-phone").val(v.phone);
		$form.find(".ip-owner").val(v.owner);
		$form.find(".ip-comments").val(v.comments);
	});
}

function submit_edit_network(e, $ni, $form)
{
	e.preventDefault();
	e.stopPropagation();
	var $descr = $form.find(".network-description");
	if ($descr.val().length < 6) {
		$descr.effect("bounce", {direction: "left"});
		return carp("Network description is too short", $descr);
	}
	var $tags = $form.find(".network-tags");
	var $cl = $form.find(".network-class");
	var v = $ni.data("@net");

	remote({
		what:		"edit-net",
		id:			v.id,
		class_id:	$cl.val(),
		descr:		$descr.val(),
		tags:		$tags.val()
	}, function (res) {
		message(res.msg);
		var $new_ni = insert_network(res);
		$form.remove();
		$ni.replaceWith($new_ni);
		var $tab = $new_ni.closest("table.networks");
		$tab.find('tr.network').removeClass('alt-row');
		$tab.find('tr.network:nth-child(even)').addClass('alt-row');
		$new_ni.effect("highlight", {}, 3000);
	});
}

function submit_merge_network(e, $ni, $form)
{
	e.preventDefault();
	e.stopPropagation();
	var v = $ni.data("@net");
	if (!v.merge_with)
		return carp("Merge error", "Don't know what networks to merge");

	var msg = "<p>Network <strong>" + v.net + "</strong> will be merged with " +
		"<strong>" + v.merge_with + "</strong></p>" +
		"<p>Are you sure you want to proceed?</p>";
	ask(msg, function () {
		remote({
			what:		"merge-net",
			id:			v.id,
			merge_with:	v.merge_with
		}, function (res) {
			message(res.msg);
			var $new_ni = insert_network(res);
			$form.remove();
			var $pages = $ni.data("$pages");
			if ($pages) $pages.remove();
			$ni.replaceWith($new_ni);
			var $tab = $new_ni.closest("table.networks");
			$tab.find('tr.network').removeClass('alt-row');
			$tab.find('tr.network:nth-child(even)').addClass('alt-row');
			var $another = $tab.find('a.address-link:contains(' + v.merge_with + ')').closest('tr.network');
			if ($another.length > 0) {
				var $af = $another.data("$form");
				if ($af) $af.remove();
				var $ap = $another.data("$pages");
				if ($ap) $ap.remove();
				$another.remove();
			}
			$new_ni.effect("highlight", {}, 3000);
		});
	});
}

function snippet(name, data)
{
	return $(picosnippet($("#" + name).children().get(0), data));
}

function carp(err, $descr)
{
	// XXX When I close it by pressing Escape, $descr does not get the focus.
	//     Maybe I should employ a timeout message of some sort.
	loading(false);
	$("<div title='Error'><p>" + err + "</p></div>").dialog({
		autoOpen:	true,
		modal:		true,
		width:		600,
		buttons:	{ Ok: function () { $(this).dialog('close'); } },
		close:		function () { if ($descr) $descr.focus(); }
	});
	return false;
}

function ask(msg, callback)
{
	$("<div title='Confirmation'><p>" + msg + "</p></div>").dialog({
		autoOpen:	true,
		modal:		true,
		width:		400,
		buttons:	{ Ok: function () { $(this).dialog('close'); callback(); },
					  Cancel: function () { $(this).dialog('close'); }}
	});
}

function show_network_history(e, $form, net, with_fill_in, special_date)
{
	e.preventDefault();
	e.stopPropagation();

	var $hist = $form.find("div.history");
	if ($hist.length > 0) {
		$hist.slideUp("fast", function () { $(this).remove() });
	} else {
		remote({ what: "net-history", net: net }, function (res) {
			var $history = snippet('network-history-table', {});
			var $tab = $history.find("table.history");
			var n = res.length;
			var fill_in = "";
			if (with_fill_in) {
				fill_in = '<a class="fill-in" href="#" title="Use this info">' +
					'<span class="form-icon ui-icon ui-icon-copy"></span></a>';
			}
			for (var i = 0; i < n; i++) {
				var v = res[i];
				var $tr = snippet('network-history-row', {
					created:     date_format(v.created),
					invalidated: date_format(v.invalidated, "still valid"),
					class_name:  v.class_name,
					description: linkify(v.descr),
					who:         v.created_by,
					actions:     fill_in
				});
				if (special_date && special_date >= v.created && special_date - v.created <= 2) {
					$tr.addClass("special");
				}
				if (with_fill_in)
					$tr.find("a.fill-in").data("@net", v).click(function (e) {
						e.preventDefault();
						e.stopPropagation();
						var $a = $(e.target).closest("a.fill-in");
						var net = $a.data("@net");
						$form.effect("highlight", {}, 1000);
						$form.find(".network-description").val(net.descr);
						$form.find(".network-class").val(net.class_id);
						$form.find(".network-tags").val(net.tags);
					});
				$tab.append($tr);
			}
			$history.hide();
			$history.find('tr:nth-child(odd)').not('tr:first').addClass('alt-row');
			$form.append($history);
			$history.slideDown("fast");
		});
	}
}

function ip_description(ip)
{
	if (ip.hostname && ip.hostname.length > 0 && ip.descr && ip.descr.length > 0)
		return linkify(ip.hostname + ": " + ip.descr);
	if (ip.hostname && ip.hostname.length > 0)
		return linkify(ip.hostname);
	if (ip.descr && ip.descr.length > 0)
		return linkify(ip.descr);
	return "";
}

function date_format(epoch, msg)
{
	if (epoch == 0)
		return msg;
	if (epoch < 0)
		return "not known";
	var d = new Date();
	d.setTime(epoch * 1000);
	var y = d.getFullYear();
	var m = d.getMonth()+1;
	if (m < 10) m = "0" + m;
	var day = d.getDate();
	if (day < 10) day = "0" + day;
	var h = d.getHours();
	if (h < 10) h = "0" + h;
	var min = d.getMinutes();
	if (min < 10) min = "0" + min;

	return y + "-" + m + "-" + day + " " + h + ":" + min;
}

function is_net_ok(net)
{
	if (net.match(/^(\d+\.\d+\.\d+\.\d+\/\d+)$/)) {
		return true;
	} else if (net.match(/^(\d+\.\d+\.\d+\/24)$/)) {
		return true;
	} else if (net.match(/^(\d+\.\d+\/16)$/)) {
		return true;
	} else if (net.match(/^(\d+\/8)$/)) {
		return true;
	} else if (net.match(/^([\da-fA-F]+(:[\da-fA-F]+){7}\/\d+)$/)) {
		return true;
	} else if (net.match(/^([\da-fA-F]+(:[\da-fA-F]+)*::\/\d+)$/)) {
		return true;
	}
	return false;
}

function inline_alert(msg)
{
	return snippet("inline-alert", { msg : msg });
}

function button_icon(cl, icon, title)
{
	return '<button class="form-icon ' + cl +
		'" title="' + title + '">' +
		'<span class="ui-icon ui-icon-' + icon +
		'"></span></button>';
}

function no_click_action($el)
{
	$el.unbind("click");
	$el.click(function (ev) {
		ev.preventDefault();
		ev.stopPropagation();
	});
}

function message(msg)
{
	if (msg) show_status(msg, 3000);
}

function loading(on)
{
	if (typeof _statusbar == "undefined")
		return;
	if (on)
		_statusbar.addClass("loader");
	else
		_statusbar.removeClass("loader");
}

function show_status(message,timeout,add)
{        
	if (typeof _statusbar == "undefined") {
		// ** Create a new statusbar instance as a global object
		_statusbar = 
			$("<div id='_statusbar' class='statusbar'><div id='status-area'>status</div><div id='login-name'>Welcome</div></div>")
			.appendTo(document.body)                   
			.show();
		_status_area = $("#status-area");
	}

	if (add)              
		// *** add before the first item    
		_status_area.prepend( "<div style='margin-bottom: 2px;' >" + message + "</div>")[0].focus();
	else    
		_status_area.text(message)

	_statusbar.show();        

	if (timeout) {
		_statusbar.addClass("statusbarhighlight");
		_statusbar.removeClass("statusbarhighlight", timeout);
	}                
}

function remote(args, func)
{
	loading(true);
	args.ver = _VER;
	$.post(_URL, args, function (r) {
		if (r.error) return carp(r.error);
		func(r); loading(false);
	}, "json");
}

function clear_selection()
{
	$("#select-menu").remove();
//	$(".ui-selected").removeClass("ui-selected");
}

function linkify(t)
{
	if (t == "")	return t;
	var n = _LINKIFY.length;
	for (var i = 0; i < n; i++) {
		var l = _LINKIFY[i];
		t = t.replace(new RegExp(l.match), "<a class='linkified' target='_blank' href='" + l.url + "'>$1</a>");
	}
	return t;
}

function can(what, class_id)
{
	if (_PERMS.superuser)
		return true;
	if (class_id) {
		return (_PERMS.by_class[class_id] && _PERMS.by_class[class_id][what]) || _PERMS[what];
	} else if (what.match(/^(net|range|ip)$/)) {
		for (var cn in _PERMS.by_class) {
			if (_PERMS.by_class.hasOwnProperty(cn) && _PERMS.by_class[cn][what])
				return true;
		}
		return _PERMS[what];
	} else {
		return _PERMS[what];
	}
}

function maybe(what, class_id, text)
{
	if (can(what, class_id))
		return text;
	return "";
}

