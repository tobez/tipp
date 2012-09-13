create function inet_contains(inet, inet)
returns boolean as $$
	select $1 >>= $2
$$ language SQL;

create table classes (
	id			integer primary key,
	name		text,
	descr		text,
	ord			integer
);

create table classes_ranges (
	id			integer primary key,
	net			cidr,
	class_id	integer references classes,
	descr		text
);
create sequence classes_ranges_id_seq;

create table networks (
	id			integer primary key,
	net			cidr,
	class_id	integer references classes,
	descr		text,
	created		integer,
	invalidated	integer,  -- 0 = still valid
	created_by	text,
	invalidated_by	text
);
create sequence networks_id_seq;

create table ips (
	id		integer primary key,
	ip		inet,
	descr		text,
	created		integer,
	invalidated	integer,  -- 0 = still valid
	created_by	text,
	invalidated_by	text
);
create sequence ips_id_seq;

create table ip_extras (
	id		integer references ips,
	location	text,
	phone		text,
	owner		text,
	hostname	text,
	comments	text
);

create table changelog (
	id		bigserial,
	change	text,
	who		text,
	what	char(1), -- R = class range, N = network, I = ip
	created	integer  -- unix time
);

create table network_tags (
	net_id	integer,
	tag		text
);
create index network_tags_net_id on network_tags (net_id);
create index network_tags_tag on network_tags (tag);

create table groups (
    id integer primary key,
    name text,
    comments text,
    permissions text
);
