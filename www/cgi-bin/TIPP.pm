package TIPP;

our $db_name = "tipp";
our $db_host = "127.0.0.1";
our $db_user = "tipp";
our $db_pass = "secret";
our $default_group_id = 1;

our $extra_header = " - development installation";

our $timezone = 'CEST';

our @linkify = (
	{
		match => '(test-link\s+(\w+))',
		url   => 'http://www.google.com/search?q=$2',
	},
);

sub log_change
{
    my %p = @_;
    #
    # If you need any extra logging, here's what available:
    #
    # $p{what}: N=network, R=range, I=ip, G=group, U=user, ?=?
    # $p{who}: user name
    # $p{when}: epoch time
    # $p{text}: description of the change
}

1;
