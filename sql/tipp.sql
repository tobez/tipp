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

insert into classes values (1, 'Customer', '', 1020);
insert into classes values (2, 'Dynamic DHCP', '', 1050);
insert into classes values (4, 'Link Network', '', 1030);
insert into classes values (9, 'Static DHCP', '', 1040);
insert into classes values (10, 'Infrastructure', '', 1010);
insert into classes values (20, 'Infrastructure (Private)', '', 2000);
insert into classes values (22, 'Office (Private)', '', 2100);
