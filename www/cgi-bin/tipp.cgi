#! /usr/bin/speedy
use 5.006;
use strict;
use warnings;

use FindBin;
use lib $FindBin::Bin;
use TIPP;
use CGI ':standard';
use JSON::XS;
use DBI;
use DBIx::Perlish;
use Encode;
use NetAddr::IP;
use Net::Netmask;
use Regexp::Common 'net';
use Net::DNS;

our $VERSION = "2010030201";
our $what   = param("what")   || "root";
our $id     = param("id")     || 0;

init();
if ((param("ver")||"") ne $VERSION) {
	result({error => "WHOA! Client/server version mismatch, try to reload the page"});
} elsif (my $handler = main->can("handle_$what")) {
	my $r = eval { $handler->(); };
	if ($r) {
		result($r);
	} else {
		result({error => "Server-side handler failed" . ($@?":<br/><code>$@</code>":"")});
	}
} else {
	result({error => "invalid request: $what"});
}
done();

# === HANDLERS ===

sub handle_config
{
	my %caps;
	for (keys %main::) {
		$caps{$1} = 1 if /^handle_(\w+)$/;
	}
	return {
		extra_header => $TIPP::extra_header,
		login        => remote_user(),
		caps         => \%caps,
		linkify      => \@TIPP::linkify,
	};
}

sub handle_root
{
	my $dbh = connect_db();
	my @c = db_fetch {
		my $t : classes;
		sort $t->ord;
	};
	return \@c;
}

sub handle_class
{
	my $dbh = connect_db();
#select cr.id,cr.net,cr.class_id,cr.descr,sum(2^(32-masklen(n.net))) from classes_ranges cr left join networks n on inet_contains(cr.net, n.net) and n.invalidated = 0 where cr.class_id = 1 group by cr.id,cr.net,cr.class_id,cr.descr;
	my @c = db_fetch {
		my $cr : classes_ranges;
		my $n : networks;
		$cr->class_id == $id;
		join $cr < $n => db_fetch {
			inet_contains($cr->net, $n->net);
			$n->invalidated == 0;
		};
		sort $cr->net;
		return $cr->id,$cr->net,$cr->class_id,$cr->descr,
			used => sum(2**(2**(family($n->net)+1)-masklen($n->net))),
			f => family($cr->net);
	};
	for my $c (@c) {
		$c->{net} =~ /\/(\d+)/;
		$c->{used} ||= 0;
		$c->{addresses} = 2**(2**($c->{f}+1)-$1) - $c->{used};
		$c->{descr} = u2p($c->{descr}||"");
	}
	return \@c;
}

sub handle_top_level_nets
{
	my $dbh = connect_db();
	my @c = map { N($_) } db_fetch {
		my $t : classes_ranges;
		return $t->net;
	};
	my @r = map { "$_" } NetAddr::IP::Compact(@c);
	return \@r;
}

sub handle_net
{
	my %p = @_;
	my $free = param("free") || "";
	$free = "" if $free eq "false";
	$free = $p{free} if exists $p{free};
	my $limit = param("limit") || "";
	$limit = "" if $limit eq "false";
	$limit = "" if $limit eq "undefined";
	$limit = $p{limit} if exists $p{limit};
	my $dbh = connect_db();
	my @c = db_fetch {
		my $cr : classes_ranges;
		my $n : networks;
		my $c : classes;
		$cr->id == $id unless $limit;
		inet_contains($limit, $n->net) if $limit;
		inet_contains($cr->net, $n->net);
		$n->invalidated == 0;
		$c->id == $n->class_id;
		sort $n->net;
		return ($n->id, $n->net,
			$n->class_id, class_name => $c->name,
			$n->descr, $n->created, $n->created_by,
			parent_class_id => $cr->class_id,
			parent_range_id => $cr->id,
			wrong_class => ($n->class_id != $cr->class_id));
	};
	if ($free) {
		my @r = db_fetch {
			my $cr : classes_ranges;
			my $c : classes;
			$cr->id == $id unless $limit;
			inet_contains($limit, $cr->net) || inet_contains($cr->net, $limit) if $limit;
			$cr->class_id == $c->id;
			return $cr->net, $cr->class_id, $cr->descr, class_name => $c->name;
		};
		return {error => "Cannot find class_range"} unless @r;
		my @miss = calculate_gaps($limit ? $limit : $r[0]->{net}, map { $_->{net} } @c);
		for (@c) { $_->{nn} = N($_->{net}) }
		for my $r (@r) {
			$r->{nn} = N($r->{net});
		}
		my @m;
		for my $c (@miss) {
			my $cid = 0;
			for my $r (@r) {
				if ($r->{nn}->contains($c)) {
					$cid = $r->{class_id};
					last;
				}
			}
			push @m, { net => "$c", nn => $c, free => 1, id => 0, class_name => "free", class_id => $cid };
		}
		@c = sort { $a->{nn} cmp $b->{nn} } (@c, @m);
	}
	my %c;
	for my $c (@c) {
		$c{$c->{net}} = $c unless $c->{free};
	}
	for my $c (@c) {
		my $this = N($c->{net});
		my $super = N($this->network->addr . "/" . ($this->masklen - 1));
		my $neighbour;
		if ($super->network->addr eq $this->network->addr) {
			$neighbour = N($super->broadcast->addr . "/" . $this->masklen)->network;
		} else {
			$neighbour = N($super->network->addr . "/" . $this->masklen);
		}
		my $merge_with = $c{$neighbour};
		if ($merge_with && $merge_with->{class_id} == $c->{class_id}) {
			$c->{merge_with} = "$neighbour";
		}
		delete $c->{nn};
		delete $c->{parent_range_id};
		$c->{descr} = u2p($c->{descr}||"");
		$c->{created_by} ||= "";
		gen_calculated_params($c);
	}
	return \@c;
}

sub handle_new_network
{
	my $net = param("net") || "";
	my $class_id = param("class_id") || 0;
	my $descr = u2p(param("descr")||"");
	my $limit = param("limit")||"";
	my $in_class_range = (param("in_class_range")||"") eq "true";

	return { error => "Network must be specified" } unless $net;
	return { error => "Network class must be specified" } unless $class_id;
	return { error => "Network description must be specified" } unless $descr;
	my $nn = N($net);
	return { error => "Bad network specification" } unless $nn;
	$nn = $nn->network;
	$net = "$nn";

	if ($limit) {
		my $n_limit = N($limit);
		return {error=>"Invalid network limit"} unless $n_limit;
		$limit = "$n_limit";
		return {error=>"Network is not within $limit"} unless $n_limit->contains($nn);
	}

	my $dbh = connect_db();
	my $cid = db_fetch {
		my $c : classes;
		$c->id == $class_id;
		return $c->id;
	};
	return { error => "Non-existing network class" } unless $cid;
	my $crid = db_fetch {
		my $cr : classes_ranges;
		inet_contains($cr->net, $net);
		return $cr->id;
	};
	return { error => "Network $net is outside of any known range" } unless $crid;
	my $first = $nn->first;
	my $last  = $nn->last;
	my $over = db_fetch {
		my $n : networks;
		$n->invalidated == 0;
		inet_contains($n->net, $net) or
		inet_contains($net, $n->net) or
		inet_contains($n->net, $first) or
		inet_contains($n->net, $last);
		return $n->net;
	};
	return { error => "Network $net overlaps with existing network $over" } if $over;

	my $when = time;
	db_insert 'networks', {
		id			=> sql("nextval('networks_id_seq')"),
		net			=> $net,
		class_id	=> $class_id,
		descr		=> $descr,
		created		=> $when,
		invalidated	=> 0,
		created_by	=> remote_user(),
	};

	my $new_net = db_fetch {
		my $cr : classes_ranges;
		my $n : networks;
		my $c : classes;
		$n->net == $net;
		$n->invalidated == 0;
		inet_contains($cr->net, $n->net);
		$c->id == $n->class_id;
		sort $n->net;
		return ($n->id, $n->net,
			$n->class_id, class_name => $c->name,
			$n->descr, $n->created, $n->created_by,
			parent_class_id => $cr->class_id,
			wrong_class => ($n->class_id != $cr->class_id));
	};
	unless ($new_net) {
		$dbh->rollback;
		return { error => "Cannot insert network" };
	}
	log_change(network => "Allocated new network $net of class $new_net->{class_name}", when => $when);
	if ($limit && !$in_class_range) {
		my $ret = handle_net(free => 1, limit => $limit);
		if ((ref($ret)||"") ne "ARRAY") {
			$dbh->rollback;
			return $ret;
		} else {
			$dbh->commit;
			return {msg => "Network $net successfully inserted", n => $ret};
		}
	}
	$dbh->commit;
	$new_net->{descr} = u2p($new_net->{descr});
	$new_net->{msg} = "Network $net successfully inserted";
	$new_net->{created_by} ||= "";
	gen_calculated_params($new_net);
	return $new_net;
}

sub handle_edit_net
{
	my $dbh = connect_db();
	my $class_id = param("class_id");
	my $descr    = u2p(param("descr"));
	my $net = db_fetch { my $n : networks;  $n->id == $id;  $n->invalidated == 0; };
	return { error => "No such network (maybe someone else changed it?)" }
		unless $net;
	$net->{descr} = u2p($net->{descr});
	my $msg;
	if ($descr ne $net->{descr} || $net->{class_id} != $class_id) {
		my $when = time;
		my $who = remote_user();
		db_update {
			my $n : networks;
			$n->id == $id;

			$n->invalidated = $when;
			$n->invalidated_by = $who;
		};
		db_insert 'networks', {
			id			=> sql("nextval('networks_id_seq')"),
			net			=> $net->{net},
			class_id	=> $class_id,
			descr		=> $descr,
			created		=> $when,
			invalidated	=> 0,
			created_by	=> $who,
		};
		$msg = "Network $net->{net} updated successfully";
		log_change(network => "Modified network $net->{net}", when => $when);
	} else {
		$msg = "Network $net->{net} was not updated because nothing has changed";
	}
	my $new_net = db_fetch {
		my $cr : classes_ranges;
		my $n : networks;
		my $c : classes;
		$n->net == $net->{net};
		$n->invalidated == 0;
		inet_contains($cr->net, $n->net);
		$c->id == $n->class_id;
		sort $n->net;
		return ($n->id, $n->net,
			$n->class_id, class_name => $c->name,
			$n->descr, $n->created, $n->created_by,
			parent_class_id => $cr->class_id,
			wrong_class => ($n->class_id != $cr->class_id));
	};
	unless ($new_net) {
		$dbh->rollback;
		return { error => "Cannot update network information" };
	}
	$dbh->commit;
	$new_net->{descr} = u2p($new_net->{descr});
	$new_net->{msg} = $msg;
	$new_net->{created_by} ||= "";
	gen_calculated_params($new_net);
	return $new_net;
}

sub handle_merge_net
{
	my $dbh = connect_db();

	my $merge_with = param("merge_with");
	return { error => "merge_with parameter is required" }
		unless $merge_with;

	my $net0 = db_fetch { my $n : networks;  $n->id == $id;  $n->invalidated == 0; };
	return { error => "No such network (maybe someone else changed it?)" }
		unless $net0;

	my $net1 = db_fetch { my $n : networks;  $n->net == $merge_with;  $n->invalidated == 0; };
	return { error => "No neighbouring network (maybe someone else changed it?)" }
		unless $net1;
	
	my $n0 = N($net0->{net});
	my $n1 = N($net1->{net});
	my $super = N($n0->network->addr . "/" . ($n0->masklen - 1))->network;
	if ($super->network->addr ne $n0->network->addr) {
		($net0,$net1) = ($net1,$net0);
		($n0,$n1)     = ($n1,$n0);
	}

	return { error => "$n0 and $n1 belong to different classes, cannot merge" }
		unless $net0->{class_id} == $net1->{class_id};

	$net0->{descr} = u2p($net0->{descr});
	$net1->{descr} = u2p($net1->{descr});
	$net0->{descr} =~ s/^\s*\[merge\]\s+//;
	$net1->{descr} =~ s/^\s*\[merge\]\s+//;
	my $descr;
	if ($net0->{descr} eq $net1->{descr}) {
		$descr = "[merge] $net0->{descr}";
	} else {
		$descr = "[merge] $net0->{descr} | $net1->{descr}";
	}

	my $when = time;
	my $who = remote_user();
	db_insert 'networks', {
		id			=> sql("nextval('networks_id_seq')"),
		net			=> "$super",
		class_id	=> $net0->{class_id},
		descr		=> $descr,
		created		=> $when,
		invalidated	=> 0,
		created_by	=> $who,
	};

	db_update {
		my $n : networks;
		$n->invalidated == 0;
		$n->id == $net0->{id} || $n->id == $net1->{id};

		$n->invalidated = $when;
		$n->invalidated_by = $who;
	};
	my $nn = "$super";
	log_change(network => "Removed network $n0 (it was merged with $n1 into $nn)", when => $when);
	log_change(network => "Removed network $n1 (it was merged with $n0 into $nn)", when => $when);

	my $new_net = db_fetch {
		my $cr : classes_ranges;
		my $n : networks;
		my $c : classes;
		$n->net == $nn;
		$n->invalidated == 0;
		inet_contains($cr->net, $n->net);
		$c->id == $n->class_id;
		sort $n->net;
		return ($n->id, $n->net,
			$n->class_id, class_name => $c->name,
			$n->descr, $n->created, $n->created_by,
			parent_class_id => $cr->class_id,
			wrong_class => ($n->class_id != $cr->class_id));
	};
	unless ($new_net) {
		$dbh->rollback;
		return { error => "Cannot merge networks in the database" };
	}

	log_change(network => "Added network $nn (via merge of $n0 and $n1)", when => $when);
	$dbh->commit;
	my $msg = "Networks $n0 and $n1 successfully merged into $nn";

	$new_net->{descr} = u2p($new_net->{descr});
	$new_net->{msg} = $msg;
	$new_net->{created_by} ||= "";
	gen_calculated_params($new_net);
	return $new_net;
}

sub handle_edit_class_range
{
	my $dbh = connect_db();
	my $class_id = param("class_id");
	my $descr    = u2p(param("descr"));
	my $range = db_fetch { my $cr : classes_ranges;  $cr->id == $id; };
	return { error => "No such class range (maybe someone else changed it?)" }
		unless $range;
	$range->{descr} = u2p($range->{descr}||"");
	my $msg;
	if ($descr ne $range->{descr} || $range->{class_id} != $class_id) {
		my $when = time;
		my $who = remote_user();
		db_update {
			my $cr : classes_ranges;
			$cr->id == $id;

			$cr->descr = $descr;
			$cr->class_id = $class_id;
		};
		$msg = "Class range $range->{net} updated successfully";
		log_change(range => "Modified class-range $range->{net}", when => $when);
	} else {
		$msg = "Class range $range->{net} was not updated because nothing has changed";
	}
	my $new_range = db_fetch {
		my $cr : classes_ranges;
		my $n : networks;

		$cr->id == $id;
		join $cr < $n => db_fetch {
			inet_contains($cr->net, $n->net);
			$n->invalidated == 0;
		};

		return $cr->id,$cr->net,$cr->class_id,$cr->descr,used => sum(2**(32-masklen($n->net)));
	};
	unless ($new_range) {
		$dbh->rollback;
		return { error => "Cannot update class range information" };
	}
	$dbh->commit;
	$new_range->{descr} = u2p($new_range->{descr}||"");
	$new_range->{msg} = $msg;
	$new_range->{net} =~ /\/(\d+)/;
	$new_range->{used} ||= 0;
	$new_range->{addresses} = 2**(32-$1) - $new_range->{used};
	return $new_range;
}

sub handle_add_class_range
{
	my $dbh = connect_db();
	my $class_id = param("class_id");
	my $descr    = u2p(param("descr"));
	my $net = param("range")||"";
	my $nn = N($net);
	return { error => "Bad class range specification" } unless $nn;
	$net = "$nn";

	my $cid = db_fetch {
		my $c : classes;
		$c->id == $class_id;
		return $c->id;
	};
	return { error => "Non-existing network class" } unless $cid;

	my $first = $nn->network;
	my $last  = $nn->broadcast;
	my $over = db_fetch {
		my $cr : classes_ranges;
		inet_contains($cr->net, $net) or
		inet_contains($net, $cr->net) or
		inet_contains($cr->net, $first) or
		inet_contains($cr->net, $last);
		return $cr->net;
	};
	return { error => "Class range $net overlaps with existing class range $over" } if $over;

	my $when = time;
	db_insert 'classes_ranges', {
		id			=> sql("nextval('classes_ranges_id_seq')"),
		net			=> $net,
		class_id	=> $class_id,
		descr		=> $descr,
	};

	my $msg = "Class range $net created successfully";
	log_change(range => "Created class-range $net", when => $when);

	my $new_range = db_fetch {
		my $cr : classes_ranges;
		my $n : networks;

		$cr->net == $net;
		join $cr < $n => db_fetch {
			inet_contains($cr->net, $n->net);
			$n->invalidated == 0;
		};

		return $cr->id,$cr->net,$cr->class_id,$cr->descr,
			used => sum(2**(2**(family($n->net)+1)-masklen($n->net))),
			f => family($cr->net);
	};
	unless ($new_range) {
		$dbh->rollback;
		return { error => "Cannot create new class range $net" };
	}
	$dbh->commit;
	$new_range->{descr} = u2p($new_range->{descr}||"");
	$new_range->{msg} = $msg;
	$new_range->{net} =~ /\/(\d+)/;
	$new_range->{used} ||= 0;
	$new_range->{addresses} = 2**(2**($new_range->{f}+1)-$1) - $new_range->{used};
	return $new_range;
}

sub handle_remove_class_range
{
	my $dbh = connect_db();

	my $range = db_fetch {
		my $cr : classes_ranges;
		my $n : networks;

		$cr->id == $id;
		join $cr < $n => db_fetch {
			inet_contains($cr->net, $n->net);
			$n->invalidated == 0;
		};

		return $cr->id,$cr->net,$cr->class_id,$cr->descr,used => sum(2**(32-masklen($n->net)));
	};

	return { error => "Class range not found!" } unless $range;
	return { error => "Class range $range->{net} is not empty!" } if $range->{used};

	my $when = time;
	db_delete {
		my $cr : classes_ranges;
		$cr->id == $id;
	};
	log_change(range => "Removed class-range $range->{net}", when => $when);
	$dbh->commit;
	return { msg => "Class range $range->{net} removed successfully" };
}

sub handle_ip_net
{
	my $ip = param("ip") || return;
	my $dbh = connect_db();
	my $net = db_fetch {
		my $cr : classes_ranges;
		my $n : networks;
		my $c : classes;
		inet_contains($n->net, $ip);
		$n->invalidated == 0;
		inet_contains($cr->net, $n->net);
		$c->id == $n->class_id;
		sort $n->net;
		return ($n->id, $n->net,
			$n->class_id, class_name => $c->name,
			$n->descr, $n->created, $n->created_by,
			parent_class_id => $cr->class_id,
			wrong_class => ($n->class_id != $cr->class_id));
	};
	$net->{descr} = u2p($net->{descr});
	$net->{created_by} ||= "";
	gen_calculated_params($net);
	return $net;
}

sub handle_net_history
{
	my $dbh = connect_db();
	my $nn = param("net") || "";
	my $net = db_fetch { my $n : networks;  $n->net == $nn; return $n->net; };
	return { error => "No network found, strange" } unless $net;
	my @net = db_fetch {
		my $cr : classes_ranges;
		my $n : networks;
		my $c : classes;
		$n->net == $net;
		inet_contains($cr->net, $n->net);
		$c->id == $n->class_id;
		sort $n->created;
		return ($n->id, $n->net,
			$n->class_id, class_name => $c->name,
			$n->descr, $n->created, $n->invalidated, $n->invalidated_by,
			parent_class_id => $cr->class_id, $n->created_by,
			wrong_class => ($n->class_id != $cr->class_id));
	};
	my $last;
	my @hist;
	for my $n (@net) {
		if ($last && $last->{invalidated} < $n->{created}) {
			my %fake;
			$fake{net}			= $net;
			$fake{class_name}	= "unallocated";
			$fake{descr}		= "";
			$fake{id}			= 0;
			$fake{created}		= $last->{invalidated};
			$fake{invalidated}	= $n->{created};
			$fake{created_by}	= $last->{invalidated_by};
			push @hist, \%fake;
		}
		push @hist, $n;
		$last = $n;
	}
	if (@hist && $hist[-1]->{invalidated} > 0) {
		my %fake;
		$fake{net}			= $net;
		$fake{class_name}	= "unallocated";
		$fake{descr}		= "";
		$fake{id}			= 0;
		$fake{created}		= $hist[-1]->{invalidated};
		$fake{invalidated}	= 0;
		$fake{created_by}	= $hist[-1]->{invalidated_by};
		push @hist, \%fake;
	}
	for my $c (@hist) {
		$c->{descr} = u2p($c->{descr});
		$c->{created_by} ||= "";
		delete $c->{invalidated_by};
	}
	@hist = reverse @hist;
	return \@hist;
}

sub handle_addresses
{
	my $net = param("net") || return;
	my $dbh = connect_db();
	my @dip = db_fetch {
		my $ip : ips;
		my $ipe : ip_extras;
		join $ip < $ipe => db_fetch { $ip->id == $ipe->id };
		$ip->invalidated == 0;
		inet_contains($net, $ip->ip);
	};
	my %ip;
	for my $ip (@dip) {
		for my $k (qw(descr location phone owner hostname comments created_by invalidated_by)) {
			$ip->{$k} ||= "";
			$ip->{$k} = u2p($ip->{$k});
		}
		$ip{$ip->{ip}} = $ip;
	}
	my $n = Net::Netmask->new2($net);
	my @ip;
	for my $ip ($n->enumerate) {
		if ($ip{$ip}) {
			push @ip, $ip{$ip};
		} else {
			push @ip, { ip => $ip, descr => "" };
		}
	}
	return \@ip;
}

sub handle_get_ip
{
	my $ip = param("ip");
	return get_ip_info($ip);
}

sub handle_ip_history
{
	my $ip = param("ip");
	return {error => "IP must be specified"} unless $ip;
	return {error => "invalid IP"} unless $ip =~ /^$RE{net}{IPv4}$/;

	my $dbh = connect_db();
	my @ip = db_fetch {
		my $i : ips;
		my $e : ip_extras;

		join $i < $e => db_fetch { $i->id == $e->id };
		$i->ip == $ip;

		sort $i->created;
	};
	for my $i (@ip) {
		for my $k (qw(descr location phone owner hostname comments created_by invalidated_by)) {
			$i->{$k} ||= "";
			$i->{$k} = u2p($i->{$k});
		}
	}
	my @r;
	my $last;
	for my $i (@ip) {
		if ($last && $last->{invalidated} < $i->{created}) {
			my %fake;
			for my $k (qw(descr location phone owner hostname comments)) {
				$fake{$k} = "";
			}
			$fake{ip}			= $ip;
			$fake{id}			= 0;
			$fake{created}		= $last->{invalidated};
			$fake{invalidated}	= $i->{created};
			$fake{created_by}	= $last->{invalidated_by};
			push @r, \%fake;
		}
		push @r, $i;
		$last = $i;
	}
	if (@r && $r[-1]->{invalidated} > 0) {
		my %fake;
		for my $k (qw(descr location phone owner hostname comments)) {
			$fake{$k} = "";
		}
		$fake{ip}			= $ip;
		$fake{id}			= 0;
		$fake{created}		= $r[-1]->{invalidated};
		$fake{invalidated}	= 0;
		$fake{created_by}	= $r[-1]->{invalidated_by};
		push @r, \%fake;
	}
	unless (@r) {
		my $start = db_fetch {
			my $n : networks;
			inet_contains($n->net, $ip);
			sort $n->created;
			return $n->created;
		};
		$start = -1 unless $start;
		my %fake;
		for my $k (qw(descr location phone owner hostname comments)) {
			$fake{$k} = "";
		}
		$fake{ip}			= $ip;
		$fake{id}			= 0;
		$fake{created}		= $start;
		$fake{invalidated}	= 0;
		$fake{created_by}	= "";
		push @r, \%fake;
	}
	@r = reverse @r;
	return \@r;
}

sub handle_edit_ip
{
	my %p;
	for my $p (qw(ip descr location phone owner hostname comments)) {
		$p{$p} = param($p);
		$p{$p} = "" unless defined $p{$p};
		$p{$p} = u2p($p{$p});
	}
	return {error => "IP must be specified"} unless $p{ip};
	return {error => "invalid IP"} unless $p{ip} =~ /^$RE{net}{IPv4}$/;

	my $old = get_ip_info($p{ip});
	my $changed = 0;
	for my $p (qw(descr location phone owner hostname comments)) {
		$changed = 1 if $old->{$p} ne $p{$p};
	}
	unless ($changed) {
		$old->{msg} = "IP $p{ip} was not updated because nothing has changed";
		return $old;
	}

	my $need_extras = 0;
	for my $p (qw(location phone owner hostname comments)) {
		$need_extras = 1 if $p{$p} ne "";
	}

	my $dbh = connect_db();
	my $when = time;
	my $who = remote_user();
	db_update {
		my $ip : ips;
		$ip->ip == $p{ip};
		$ip->invalidated == 0;

		$ip->invalidated = $when;
		$ip->invalidated_by = $who;
	};
	my $msg = "IP $p{ip} updated successfully";
	if ($p{descr} ne "" || $need_extras) {
		my $id = db_fetch { return `nextval('ips_id_seq')`; };
		db_insert 'ips', {
			id			=> $id,
			ip			=> $p{ip},
			descr		=> $p{descr},
			created		=> $when,
			invalidated	=> 0,
			created_by	=> $who,
		};
		if ($need_extras) {
			db_insert 'ip_extras', {
				id			=> $id,
				location	=> $p{location},
				phone		=> $p{phone},
				owner		=> $p{owner},
				hostname	=> $p{hostname},
				comments	=> $p{comments},
			};
		}
		log_change(ip => "Modified IP $p{ip}", when => $when);
	} else {
		$msg = "IP $p{ip} removed successfully";
		log_change(ip => "Removed IP $p{ip}", when => $when);
	}
	my $new = get_ip_info($p{ip});
	$new->{msg} = $msg;
	$dbh->commit;
	return $new;
}

sub xhandle_edit_range_list
{
}

sub handle_remove_net
{
	my $dbh = connect_db();
	my $net = db_fetch {
		my $n : networks;
		$n->id == $id;
		return $n->net;
	};
	return {error => "Network not found"} unless $net;
	my $when = time;
	my $who = remote_user();
	db_update {
		my $ip : ips;
		inet_contains($net, $ip->ip);
		$ip->invalidated == 0;

		$ip->invalidated = $when;
		$ip->invalidated_by = $who;
	};
	db_update {
		my $n : networks;
		$n->invalidated == 0;
		$n->net == $net;

		$n->invalidated = $when;
		$n->invalidated_by = $who;
	};
	log_change(network => "Removed network $net", when => $when);
	$dbh->commit;
	return {msg => "Network $net successfully removed"};
}

sub handle_search
{
	my $s = u2p(param("q") || "");

	return {error => "search string not specified"} if $s eq "";
	my @s = split / /, $s;
	for (@s) { s/\s+//g }
	@s = grep { $_ ne "" } @s;
	return {error => "blank search string"} unless @s;

	my %r = (search_networks(@s), search_ips(@s));
	$r{n} ||= [];
	$r{i} ||= [];
	return \%r;
}

sub handle_suggest_network
{
	my $sz = param("sz");
	my $limit = param("limit") || "";
	return {error=>"Network size is not specified"} unless $sz;
	$sz =~ s/.*?(\d+)$/$1/;
	return {error=>"Bad network size"} unless $sz =~ /^\d+$/;
	return {error=>"Invalid network size"} unless $sz >= 8 && $sz <= 128;
	my (%cr, @all);
	my $dbh = connect_db();
	if ($limit) {
		my $n_limit = N($limit);
		return {error=>"Invalid network limit"} unless $n_limit;
		$limit = "$n_limit";
		@all = map { { range => $limit, net => $_ } } db_fetch {
			my $n : networks;

			inet_contains($limit, $n->net);
			$n->invalidated == 0;

			return $n->net;
		};
		$cr{$limit} = [];
	} else {
		@all = db_fetch {
			my $cr : classes_ranges;
			my $n : networks;

			$cr->class_id == $id;
			join $cr < $n => db_fetch {
				inet_contains($cr->net, $n->net);
				$n->invalidated == 0;
			};

			return range => $cr->net, net => $n->net;
		};
	}
	for my $b (@all) {
		$cr{$b->{range}} ||= [];
		next unless $b->{net};
		my $n = N($b->{net});
		push @{$cr{$b->{range}}}, $n if $n;
	}
	my %sz;
	for my $r (keys %cr) {
		my $b = N($r);
		if (@{$cr{$r}}) {
			my @miss = calculate_gaps($r, @{$cr{$r}});
			for my $m (@miss) {
				push @{$sz{$m->masklen}}, $m;
			}
		} else {
			push @{$sz{$b->masklen}}, $b;
		}
	}
	my $check_sz = $sz;
	while ($check_sz >= 8) {
		if ($sz{$check_sz}) {
			my $n = $sz{$check_sz}->[rand @{$sz{$check_sz}}];
			return {n => $n->network->addr . "/$sz"};
		}
		$check_sz--;
	}
	return {error=>"Cannot find a free network of size $sz" . ($limit ? " inside $limit" : "")};
}

sub handle_split
{
	my $ip = param("ip") || "";
	return {error => "split IP must be specified"} unless $ip;
	return {error => "invalid split IP"} unless $ip =~ /^$RE{net}{IPv4}$/;
	my $dbh = connect_db();
	my $nf = db_fetch {
		my $n : networks;
		$n->invalidated == 0;
		inet_contains($n->net, $ip);
	};
	return {error => "network to split not found"} unless $nf;
	my $net = $nf->{net};
	my $n = Net::Netmask->new2($net);
	return {error => "invalid network to split"} unless $n;
	my $sz;
	for my $sz0 (reverse (8..32)) {
		$sz = $sz0;
		my $sp = Net::Netmask->new2("$ip/$sz");
		last unless $sp;
		last unless $sp->broadcast eq $ip;
		last if $sz < $n->bits;
	}
	return {error => "unable to find split point [sz $sz]"} if $sz >= 32;
	$sz++;
	my $extra_msg = $sz >= 31 ? "The split will have networks of size $sz - this looks like a mistake" : "";
	my $sn = Net::Netmask->new2("$ip/$sz");
	my @n = $n->cidrs2inverse($sn);
	@n = sort { $a cmp $b } (@n, $sn);
	if (param("confirmed")) {
		my $when = time;
		my $who = remote_user();
		my $descr = $nf->{descr};
		$descr = "[split] $descr" unless $descr =~ /^\[split\]/;
		for my $nn (@n) {
			db_insert 'networks', {
				id			=> sql("nextval('networks_id_seq')"),
				net			=> "$nn",
				class_id	=> $nf->{class_id},
				descr		=> $descr,
				created		=> $when,
				invalidated	=> 0,
				created_by	=> $who,
			};
			log_change(network => "Added network $nn (via split)", when => $when);
			my $ip_network   = "" . $nn->base;
			unless (db_fetch { my $i : ips; $i->ip == $ip_network; $i->invalidated == 0; return $i->id; }) {
				my $id = db_fetch { return `nextval('ips_id_seq')`; };
				db_insert 'ips', {
					id			=> $id,
					ip			=> $ip_network,
					descr		=> "Subnet",
					created		=> $when,
					invalidated	=> 0,
					created_by	=> $who,
				};
				log_change(ip => "Recorded IP $ip_network as a subnet address (via split)", when => $when);
			}
			my $ip_broadcast = "" . $nn->broadcast;
			unless (db_fetch { my $i : ips; $i->ip == $ip_broadcast; $i->invalidated == 0; return $i->id; }) {
				my $id = db_fetch { return `nextval('ips_id_seq')`; };
				db_insert 'ips', {
					id			=> $id,
					ip			=> $ip_broadcast,
					descr		=> "Broadcast",
					created		=> $when,
					invalidated	=> 0,
					created_by	=> $who,
				};
				log_change(ip => "Recorded IP $ip_broadcast as a broadcast address (via split)", when => $when);
			}
		}
		db_update {
			my $n : networks;
			$n->invalidated == 0;
			$n->net == $net;

			$n->invalidated = $when;
			$n->invalidated_by = $who;
		};
		my @new = db_fetch {
			my $cr : classes_ranges;
			my $n : networks;
			my $c : classes;
			inet_contains($net, $n->net);
			$n->invalidated == 0;
			inet_contains($cr->net, $n->net);
			$c->id == $n->class_id;
			sort $n->net;
			return ($n->id, $n->net,
				$n->class_id, class_name => $c->name,
				$n->descr, $n->created, $n->created_by,
				parent_class_id => $cr->class_id,
				wrong_class => ($n->class_id != $cr->class_id));
		};
		unless (@new) {
			$dbh->rollback;
			return { error => "Cannot split network $net" };
		}
		for my $new_net (@new) {
			$new_net->{descr} = u2p($new_net->{descr}||"");
			$new_net->{created_by} ||= "";
			gen_calculated_params($new_net);
		}
		log_change(network => "Removed network $net (via split)", when => $when);
		$dbh->commit;
		return {msg => "Network $net successfully split", n => \@new};
	} else {
		@n = map { "$_" } @n;
		return {n => \@n, o => "$n", extra_msg => $extra_msg };
	}
}

sub handle_changelog
{
	my $filter = param("filter") || "";
	my $page = param("page") || 0;
	$page = 0 if $page < 0;
	my $pagesize = param("pagesize") || 30;
	my $dbh = connect_db();

	my @s = split / /, $filter;
	for (@s) { s/\s+//g }
	@s = grep { $_ ne "" } @s;

	my @filter = ('?');
	my @bind;
	for my $s (@s) {
		# XXX daylight savings troubles!!!
		push @filter, "(text(timestamp with time zone 'epoch' at time zone '$TIPP::timezone' + created * interval '1 second') ilike ? ".
			"or who ilike ? or change ilike ?)";
		push @bind, "%$s%", "%$s%", "%$s%";
	}

=pod
This is possibly an efficient but horrible way to match dates.
The above way is probably inefficient but works good enough.

		if ($s =~ /^XY(\d+)-(\d+)-(\d+)$/) {
			# looks like a date
			push @filter, "((timestamp 'epoch' + created * interval '1 second')::date " .
				" = ?::date or who ilike ? or change ilike ?)";
			push @bind, $s, "%$s%", "%$s%";
		} elsif ($s =~ /^XY(\d+)-(\d+)$/) {
			# looks like a month
			push @filter,
				"((timestamp 'epoch' + created * interval '1 second')::date ".
				"<= (date_trunc('month', ?::date) + ".
				"interval '1 month' - interval '1 day')::date ".
				"and ".
				"(timestamp 'epoch' + created * interval '1 second')::date ".
				">= ?::date or who ilike ? or change ilike ?)";
			push @bind, "$s-01", "$s-01", "%$s%", "%$s%";
=cut

	my @e = @{
		$dbh->selectall_arrayref("select * " .
			" from changelog where " .
			join(" and ", @filter) . " order by created desc, id limit ? offset ?",
			{Slice=>{}}, 't', @bind, $pagesize + 1, $page * $pagesize)
		|| []
	};

	my $next = 0;
	if (@e > $pagesize) {
		pop @e;
		$next = 1;
	}
	return {
		p => $page,
		n => $next,
		e => \@e,
	};
}

sub handle_nslookup
{
	my $ip = param("ip") || "";
	return {error => "IP must be specified"} unless $ip;
	return {error => "invalid IP address"} unless $ip =~ /^$RE{net}{IPv4}$/;

	my $res = Net::DNS::Resolver->new;
	$res->udp_timeout(2);
	my $query = $res->query($ip);

	if ($query) {
		for my $rr ($query->answer) {
			next unless $rr->type eq "PTR";
			return {host => $rr->ptrdname};
		}
		return {error => "PTR record for $ip not found"};
	}
	return {error => "DNS query for $ip failed: " . $res->errorstring};
}

sub handle_paginate
{
	my $nn = param("net");
	return { error => "Network must be specified" } unless $nn;
	my $n = Net::Netmask->new2($nn);
	return { error => "Invalid network: $nn" } unless $n;
	if ($n->size <= 64) {
		my $l = $n->broadcast; $l =~ s/.*\.//;
		return [{base=>$n->base,last=>$l,bits=>$n->bits}];
	} else {
		my @r;
		for my $ip ($n->enumerate(26)) {
			my $i = Net::Netmask->new2("$ip/26");
			my $l = $i->broadcast; $l =~ s/.*\.//;
			push @r, {base=>$ip,last=>$l,bits=>26};
		}
		return \@r;
	}
}

sub handle_describe_ip
{
	my $ip = param("ip") || "";
	return {error => "IP must be specified"} unless $ip;
	return {error => "invalid IP address"} unless $ip =~ /^$RE{net}{IPv4}$/;

	my $start = param("start") || "";
	return {error => "start must be specified"} unless $start;
	return {error => "start is not a number"} unless $start =~ /^\d+$/;

	my $stop = param("stop") || "";
	return {error => "stop must be specified"} unless $stop;
	return {error => "stop is not a number"} unless $stop =~ /^\d+$/;

	my $dbh = connect_db();
	my @info = db_fetch {
		my $i : ips;
		my $n : networks;
		my $c : classes;
		$i->ip == $ip;
		$i->invalidated >= $start || $i->invalidated == 0;
		$stop >= $i->created;
		inet_contains($n->net, $ip);
		$n->invalidated >= $start || $n->invalidated == 0;
		$c->id == $n->class_id;
		$stop >= $n->created;
		sort $i->created;
		return $i, class_name => $c->name;
	};
	for my $info (@info) {
		my $e = db_fetch {
			my $e : ip_extras;
			$e->id == $info->{id};
		};
		%$info = (%$info, %$e) if $e;
	}
	my @net = db_fetch {
		my $n : networks;
		my $c : classes;
		inet_contains($n->net, $ip);
		$n->invalidated >= $start || $n->invalidated == 0;
		$stop >= $n->created;
		$c->id == $n->class_id;
		sort $n->created;
		return $n, class_name => $c->name;
	};
	return [@info,@net];
}

# === END OF HANDLERS ===

sub gen_calculated_params
{
	my $c = shift;
	my $n = N($c->{net});
	$c->{net}          = "$n";
	$c->{first}        = $n->network->addr;
	$c->{last}         = $n->broadcast->addr;
	$c->{second}       = $n->first->addr;
	$c->{next_to_last} = $n->last->addr;
	$c->{sz}           = 2**($n->bits-$n->masklen);
	$c->{bits}         = $n->masklen;
	$c->{f}            = $n->version;
	if ($c->{net} =~ /^10\.|^172\.|^192\.168\./) {
		if ($c->{net} =~ /^10\./) {
			$c->{private} = 1;
		} elsif ($c->{net} =~ /^172\.(\d+)\./ && $1 >= 16 && $1 <= 31) {
			$c->{private} = 1;
		} elsif ($c->{net} =~ /^192\.168\./) {
			$c->{private} = 1;
		}
	}
}

sub get_ip_info
{
	my $ip = shift;
	my $dbh = connect_db();
	my $info = db_fetch {
		my $i : ips;
		$i->ip == $ip;
		$i->invalidated == 0;
	};
	if ($info) {
		my $e = db_fetch {
			my $e : ip_extras;
			$e->id == $info->{id};
		};
		%$info = (%$info, %$e) if $e;
	} else {
		$info = {};
	}

	$info->{ip} ||= $ip;
	$info->{id} ||= 0;
	$info->{invalidated} ||= 0;
	for my $k (qw(descr location phone owner hostname comments)) {
		$info->{$k} ||= "";
		$info->{$k} = u2p($info->{$k});
	}

	return $info;
}

sub search_networks
{
	my @s = @_;
	my $only = param("only") || "";
	return () if $only && $only ne "net";
	my @net_sql = ('n.invalidated = 0', 'n.class_id = c.id', 'cr.net >>= n.net');
	my @net_bind;
	for my $t (@s) {
		if ($t =~ /^(\d+)\.$/ && $1 > 0 && $1 <= 255) {
			push @net_sql, "n.net <<= ?";
			push @net_bind, "$1.0.0.0/8";
		} elsif ($t =~ /^(\d+)\.(\d+)\.?$/ && $1 >0 && $1 <= 255 && $2 <= 255) {
			push @net_sql, "(n.net <<= ? or n.net >>= ?)";
			push @net_bind, "$1.$2.0.0/16", "$1.$2.0.0/16";
		} elsif ($t =~ /^(\d+)\.(\d+)\.(\d+)\.?$/ && $1 >0 && $1 <= 255 && $2 <= 255 && $3 <= 255) {
			push @net_sql, "(n.net <<= ? or n.net >>= ?)";
			push @net_bind, "$1.$2.$3.0/24", "$1.$2.$3.0/24";
		} elsif ($t =~ /^$RE{net}{IPv4}$/) {
			push @net_sql, "(n.net >>= ?)";
			push @net_bind, $t;
		} elsif ($t =~ /^$RE{net}{IPv4}\/(\d+)$/ && $1 <= 32) {
			push @net_sql, "(n.net <<= ? or n.net >>= ?)";
			push @net_bind, $t, $t;
		} else {
			push @net_sql, "n.descr ilike ?";
			push @net_bind, "%$t%";
		}
	}
	my $dbh = connect_db();
	my @n = @{
		$dbh->selectall_arrayref("select " .
			"n.net, n.id, n.class_id, c.name as class_name, n.descr, n.created, n.created_by, " .
			"cr.class_id as parent_class_id, (n.class_id <> cr.class_id) as wrong_class" .
			" from networks n,classes c,classes_ranges cr where " .
			join(" and ", @net_sql) . " order by net",
			{Slice=>{}}, @net_bind)
		|| []
	};
	if (@n < 50 || param("all")) {
		for my $n (@n) {
			$n->{created_by} ||= "";
			$n->{descr} = u2p($n->{descr});
			gen_calculated_params($n);
		}
		return (n => \@n, nn => scalar(@n));
	} else {
		return (nn => scalar(@n),
			net_message => "Too many networks found, try to limit the search, or {view all results anyway}.");
	}
}

sub search_ips
{
	my @s = @_;
	my $only = param("only") || "";
	return () if $only && $only ne "ip";
	my @ip_sql = ('i.invalidated = 0');
	my @ip_bind;
	for my $t (@s) {
		if (@s > 1 && $t =~ /^(\d+)\.$/ && $1 > 0 && $1 <= 255) {
			push @ip_sql, "i.ip <<= ?";
			push @ip_bind, "$1.0.0.0/8";
		} elsif (@s > 1 && $t =~ /^(\d+)\.(\d+)\.?$/ && $1 >0 && $1 <= 255 && $2 <= 255) {
			push @ip_sql, "i.ip <<= ?";
			push @ip_bind, "$1.$2.0.0/16", $t;
		} elsif (@s > 1 && $t =~ /^(\d+)\.(\d+)\.(\d+)\.?$/ && $1 >0 && $1 <= 255 && $2 <= 255 && $3 <= 255) {
			push @ip_sql, "i.ip <<= ?";
			push @ip_bind, "$1.$2.$3.0/24";
		} elsif ($t =~ /^$RE{net}{IPv4}$/) {
			push @ip_sql, "i.ip = ?";
			push @ip_bind, $t;
		} elsif (@s > 1 && $t =~ /^$RE{net}{IPv4}\/(\d+)$/ && $1 <= 32) {
			push @ip_sql, "i.ip <<= ?";
			push @ip_bind, $t;
		} else {
			my @or = map { "$_ ilike ?" } qw(i.descr e.location e.phone e.owner e.hostname);
			push @ip_bind, ("%$t%") x 5;
			if ($t =~ /^(\d+)\.(\d+)$/ && $1 <= 255 && $2 <= 255) {
				push @or, "text(i.ip) like ?";
				push @ip_bind, "%$t/32";
			} elsif ($t =~ /^(\d+)\.(\d+)\.(\d+)$/ && $1 <= 255 && $2 <= 255 && $3 <= 255) {
				push @or, "text(i.ip) like ?";
				push @ip_bind, "%$t/32";
			}
			push @ip_sql, "(" . join(" or ", @or) . ")";
		}
	}
	my $dbh = connect_db();
	my @i = @{
		$dbh->selectall_arrayref("select * from ips i left join ip_extras e on i.id = e.id where " .
			join(" and ", @ip_sql) . " order by ip",
			{Slice=>{}}, @ip_bind)
		|| []
	};
	if (@i <= 64 || param("all")) {
		for my $i (@i) {
			for my $k (qw(descr location phone owner hostname comments created_by invalidated_by)) {
				$i->{$k} ||= "";
				$i->{$k} = u2p($i->{$k});
			}
		}
		return (i => \@i, ni => scalar(@i));
	} else {
		return (ni => scalar(@i),
			ip_message => "Too many IPs found, try to limit the search, or {view all results anyway}.");
	}
}

sub log_change
{
	my ($what, $change, %p) = @_;
	$what = "N" if $what eq "network";
	$what = "R" if $what eq "range";
	$what = "I" if $what eq "ip";
	$what = "?" unless length($what) == 1;
	my $when = $p{when} || time;
	my $dbh = connect_db();
	db_insert 'changelog', {
		change	=> $change,
		who		=> remote_user(),
		what	=> $what,
		created	=> $when,
	};
}

sub result
{
	my $d = shift;
	print json_header();
	print encode_json($d);
}

sub json_header
{
	header(
		-type    => "text/x-json",
		-expires => "-1d",
		-Pragma  => "no-cache",
		-charset => "utf-8",
	);
}

sub u2p { decode("utf-8", shift) }

sub init
{
	my $dbh = connect_db();
	$dbh->{AutoCommit} = 0;
	$what =~ s/-/_/g;
}

sub done
{
	my $dbh = connect_db();
	$dbh->{AutoCommit} = 1;
}

our $db_handler;
sub connect_db
{
	return $db_handler if $db_handler;
	$db_handler = DBI->connect("dbi:Pg:dbname=$TIPP::db_name;host=$TIPP::db_host", $TIPP::db_user, $TIPP::db_pass, {AutoCommit => 0});
}

# === code around deficiencies in NetAddr::IP

sub calculate_gaps
{
	my ($outer, @inner) = @_;
	my $out = N($outer);
	my $len = $out->masklen();
	my $of = $out->network;
	my $ol = $out->broadcast;
	my @in = sort map { N($_) } @inner;
	my @r;
	for my $in (@in) {
		last unless $of;  # XXX the whole outer range exhausted, no need to continue
		my $if = N($in->network->addr . "/$len");
		my $il = N($in->broadcast->addr . "/$len");
		if ($if < $of) {
			next;  # XXX the current inner is below outer range, skipping
		} elsif ($if == $of) {
			$of = $il + 1;
			$of = undef if $of == $out->network;
		} else {
			push @r, [$of, $if-1];
			$of = $il + 1;
			$of = undef if $of == $out->network;
		}
	}
	if ($of) {
		push @r, [$of, $ol];
	}
	my @n;
	for my $r (@r) {
		my ($f, $l) = @$r;
		my $len = $f->masklen;
		while ($f < $l) {
			while ($f->network < $f || $f->broadcast > N($l->addr . "/" . $f->masklen)) {
				$f = N($f->addr . "/" . ($f->masklen + 1));
			}
			push @n, $f;
			$f = N($f->broadcast->addr . "/$len");
			last if $f->addr eq $l->addr;
			$f++;
		}
	}
	@n;
}

sub N { TIPP::NetAddr::IP->new(@_) }

package TIPP::NetAddr::IP;
use NetAddr::IP;
use base 'NetAddr::IP';
use overload '""' => sub { $_[0]->version == 4 ? $_[0]->cidr : $_[0]->short . "/" . $_[0]->masklen };

1;
