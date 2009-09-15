package TIPP;

our $db_name = "tipp";
our $db_host = "127.0.0.1";
our $db_user = "tipp";
our $db_pass = "secret";

our $extra_header = " - development installation";

our $timezone = 'CEST';

our @linkify = (
	{
		match => '(test-link\s+(\w+))',
		url   => 'http://www.google.com/search?q=$2',
	},
);

1;
