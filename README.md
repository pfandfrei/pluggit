pluggit
=======

CCU.IO adapter for monitoring Pluggit ventilation unit

=============================================================================================
Disclaimer:
=============================================================================================
!!! Never trust a software developer !!! Always be sure what you are doing!

This software is developed and tested on a Pluggit Avent AP310 ventilation unit.
Information about Pluggit ModBus(R) register can be found at http://www.pluggit.com

The software uses the nodejs ModBus(R) stack which can be found here:
  https://github.com/ericleong/node-modbus-stack

To create database use pluggit.sql

=============================================================================================
settings.json
=============================================================================================
CCU.IO settings
MySQL table will be created automatically if it is defined in settings and does not exist

  "enabled": true,
  "mode": "periodical",
  "period": 60,
  "firstId": 102000,
  "debug": false,
  "settings":
  {
    "host": "192.168.2.100",   => ip address of ventilation unit
    "port": 502,               => should be always 502
    "mysql":                   => remove for no mysql database
    {
      "host": "127.0.0.1",     => ip of mysql server
      "user": "USER",          => mysql server user name
      "pass": "PASS",          => mysql server password
      "database": "DATABASE"   => logging database name (table name is luxtronik)
    }
  }

=============================================================================================
pluggit.js
=============================================================================================
main module
- general initialisation
- read out pluggit spot values
- store values in rega and database

=============================================================================================
channellist.json
=============================================================================================
This files contains a definition of the requested data blocks

=============================================================================================
pluggit.sql
=============================================================================================
use to create mysql database