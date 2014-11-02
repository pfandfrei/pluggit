/**
 *      CCU.IO Pluggit 0.9.0
 *      (C) Frank Motzkau
 */

"use strict";

/* common code */

var settings = require(__dirname+'/../../settings.js');

if (!settings.adapters.pluggit || !settings.adapters.pluggit.enabled)
{
    process.exit();
}

/* set true for more debugging info */
var debug = settings.adapters.pluggit.debug;

var io = require('socket.io-client');
var logger = require(__dirname+'/../../logger.js');
var socket;
if (settings.ioListenPort)
{
    socket = io.connect("127.0.0.1",
        {
            port: settings.ioListenPort
        });
}
else if (settings.ioListenPortSsl)
{
    socket = io.connect("127.0.0.1",
        {
            port: settings.ioListenPortSsl,
            secure: true
        });
}
else
{
    process.exit();
}

socket.on('connect', function ()
{
    dbgout("adapter pluggit connected to ccu.io");
});

socket.on('disconnect', function ()
{
    dbgout("adapter pluggit disconnected from ccu.io");
});

function stop()
{
    dbgout("adapter pluggit terminating");
    setTimeout(function ()
    {
        process.exit();
    }, 250);
}

process.on('SIGINT', function ()
{
    stop();
});

process.on('SIGTERM', function ()
{
    stop();
});

var blocks = require(__dirname+'/channellist.json');

// ------------------------------------------
// get rega objects
// ------------------------------------------
var metaObjects = {};
var metaIndex = {};
var dataLoaded = false;

socket.emit('getObjects', function(objects)
{
    dbgout("adapter pluggit fetched metaObjects from ccu.io");
    metaObjects = objects;
    socket.emit('getIndex', function(objIndex)
    {
        dbgout("adapter pluggit fetched metaIndex from ccu.io");
        metaIndex = objIndex;
        dataLoaded = true;

        initRega();
        requestBlock(0);
    });
});

// ------------------------------------------
// debugging
// ------------------------------------------
function dbgout(log)
{
    if (debug)
    {
        logger.info(log);
        console.log(log);
    }
}

// ------------------------------------------
// tools
// ------------------------------------------
function setState(id, val)
{
    socket.emit("setState", [id,val]);
}

function setObject(id, obj)
{
    metaObjects[id] = obj;

    if (obj.Value)
    {
        metaIndex.Address[obj.Name] = obj.Value;
    }

    socket.emit("setObject", id, obj);
}

var timestamp = Math.round(new Date().getTime() / 1000);

// 'RIR' contains the "Function Code" that we are going to invoke on the remote device
var FC = require('modbus-stack').FUNCTION_CODES;

// IP and port of the MODBUS slave, default port is 502
var client = require('modbus-stack/client').createClient(settings.adapters.pluggit.settings.port, settings.adapters.pluggit.settings.host);
var buffer = require('buffer').Buffer;

/* modbus data is stored here */
var dp = new Array();

/* request modbus data block */
function requestBlock(blockindex)
{
    client.request(FC.READ_HOLDING_REGISTERS, blocks[blockindex].start, blocks[blockindex].len, function(err, response)
    {
        if (err)
        {
            /* stop on error */
            dbgout(err);
            stop();
        }

        /* write modbus data array to buffer
        * this is easier to handle/convert the data
        * */
        var buf = new buffer(response.length*2);
        for (var i=0; i<response.length; i++)
        {
            buf.writeUInt16LE(response[i],i*2);
        }

        /* convert data depending on current block */
        switch (blockindex)
        {
            case 0:
                dp['serial'] = buf.readUInt32LE(4)+(buf.readUInt32LE(8)<<32);
                dp['name'] = buf.toString('utf-8',12,32);
                dp['version'] = buf.readUInt8(45)+'.'+ buf.readUInt8(44);

                setState(settings.adapters.pluggit.firstId+1, dp['name']);
                setState(settings.adapters.pluggit.firstId+2, dp['serial']);
                setState(settings.adapters.pluggit.firstId+3, dp['version']);

                dbgout("\r\nsn: " + dp['serial']);
                dbgout("\r\nname: " + dp['name']);
                dbgout("\r\nfw: " + dp['version']);
                break;
            case 1:
                dp['t1'] = buf.readFloatLE(0);
                dp['t2'] = buf.readFloatLE(4);
                dp['t3'] = buf.readFloatLE(8);
                dp['t4'] = buf.readFloatLE(12);
                dp['t5'] = buf.readFloatLE(16);

                setState(settings.adapters.pluggit.firstId+10, dp['t1']);
                setState(settings.adapters.pluggit.firstId+11, dp['t2']);
                setState(settings.adapters.pluggit.firstId+12, dp['t3']);
                setState(settings.adapters.pluggit.firstId+13, dp['t4']);
                setState(settings.adapters.pluggit.firstId+14, dp['t5']);

                dbgout("\r\nt1: " + dp['t1'] + "°C");
                dbgout("\r\nt2: " + dp['t2'] + "°C");
                dbgout("\r\nt3: " + dp['t3'] + "°C");
                dbgout("\r\nt4: " + dp['t4'] + "°C");
                dbgout("\r\nt5: " + dp['t5'] + "°C");
                break;
            case 2:
                dp['filter'] = buf.readUInt32LE(0);
                dp['humidity'] = buf.readUInt32LE(4);
                dp['bypass'] = buf.readUInt32LE(8);
                switch (dp['bypass'])
                {
                    case 0x0000:
                        dp['bypassState']='closed';
                        break;
                    case 0x0001:
                        dp['bypassState']='in process';
                        break;
                    case 0x0020:
                        dp['bypassState']='closing';
                        break;
                    case 0x0040:
                        dp['bypassState']='opening';
                        break;
                    case 0x00FF:
                        dp['bypassState']='opened';
                        break;
                    default:
                        dp['bypassState']='unknown';
                        break;
                }

                setState(settings.adapters.pluggit.firstId+20, dp['filter']);
                setState(settings.adapters.pluggit.firstId+22, dp['humidity']);
                setState(settings.adapters.pluggit.firstId+23, dp['bypass']);
                setState(settings.adapters.pluggit.firstId+24, dp['bypassState']);

                dbgout("\r\nfilter: " + dp['filter'] + " month");
                dbgout("\r\nRH: " + dp['humidity'] + "%");
                dbgout("\r\nBypass: " + dp['bypass'] + ' (' + dp['bypassState'] + ')');
                break;
            case 3:
                dp['speed'] = buf.readUInt16LE(0);
                setState(settings.adapters.pluggit.firstId+25, dp['speed']);
                dbgout("\r\nspeed: " + dp['speed']);
                break;
            case 4:
                dp['alarm'] = buf.readUInt16LE(0);
                switch (dp['alarm'])
                {
                    case 0:
                        dp['alarmState']='None';
                        break;
                    case 1:
                        dp['alarmState']='Exhaust FAN Alarm';
                        break;
                    case 2:
                        dp['alarmState']='Supply FAN Alarm';
                        break;
                    case 3:
                        dp['alarmState']='Bypass Alarm';
                        break;
                    case 4:
                        dp['alarmState']='T1 Alarm';
                        break;
                    case 5:
                        dp['alarmState']='T2 Alarm';
                        break;
                    case 6:
                        dp['alarmState']='T3 Alarm';
                        break;
                    case 7:
                        dp['alarmState']='T4 Alarm';
                        break;
                    case 8:
                        dp['alarmState']='T5 Alarm';
                        break;
                    case 9:
                        dp['alarmState']='RH Alarm';
                        break;
                    case 10:
                        dp['alarmState']='Outdoor13 Alarm';
                        break;
                    case 11:
                        dp['alarmState']='Supply5 Alarm';
                        break;
                    case 12:
                        dp['alarmState']='Fire Alarm';
                        break;
                    case 13:
                        dp['alarmState']='Communication Alarm';
                        break;
                    case 14:
                        dp['alarmState']='FireTermostat Alarm';
                        break;
                    case 15:
                        dp['alarmState']='VOC Alarm';
                        break;
                    default:
                        dp['alarmState']='unknown';
                        break;
                }
                setState(settings.adapters.pluggit.firstId+30, dp['alarm']);
                setState(settings.adapters.pluggit.firstId+31, dp['alarmState']);
                dbgout("\r\nalarm: " + dp['alarm'] + ' ('+dp['alarmState']+')');
                break;
            case 5:
                dp['filterReset'] = buf.readUInt16LE(0);
                setState(settings.adapters.pluggit.firstId+22, dp['filterReset']);
                dbgout("\r\nfilter reset: " + dp['filterReset'] + ' days');
                break;
            case 6:
                dp['workTime'] = buf.readUInt32LE(0);
                setState(settings.adapters.pluggit.firstId+40, dp['workTime']);
                dbgout("\r\work time: " + dp['workTime'] + ' hours');
                break;
            default:
                /* should not happen */
                stop();
        }

        if (++blockindex < Object.keys(blocks).length)
        {
            /* request next block
             * be aware that this is a recursive call
             */
            requestBlock(blockindex);
        }
        else
        {
            /* store all data in database */
            storeDatabase(timestamp, dp);
            /* now all is done */
            stop();
        }
    });
};

/* init rega objects */
function initRega()
{
    setObject(settings.adapters.pluggit.firstId,
        {
        Name: "pluggit",
        TypeName: "DEVICE",
        HssType: "PLUGGIT",
        Address: "pluggit",
        Interface: "CCU.IO",
        Channels: [
            settings.adapters.pluggit.firstId + 1
        ]
        //_persistent: true
    });

    setObject(settings.adapters.pluggit.firstId+1,
        {
            Name: "name",
            DPInfo: "INFO",
            TypeName: "VARDP",
            ValueMin: null,
            ValueMax: null,
            ValueUnit: "",
            ValueType: 20,
            Parent: settings.adapters.pluggit.firstId
            //_persistent: true
        });

    setObject(settings.adapters.pluggit.firstId+2,
        {
            Name: "serial",
            DPInfo: "INFO",
            TypeName: "VARDP",
            ValueMin: null,
            ValueMax: null,
            ValueUnit: "",
            ValueType: 16,
            Parent: settings.adapters.pluggit.firstId
            //_persistent: true
        });

    setObject(settings.adapters.pluggit.firstId+3,
        {
            Name: "firmware version",
            DPInfo: "INFO",
            TypeName: "VARDP",
            ValueMin: null,
            ValueMax: null,
            ValueUnit: "",
            ValueType: 20,
            Parent: settings.adapters.pluggit.firstId
            //_persistent: true
        });

    setObject(settings.adapters.pluggit.firstId+10,
        {
            Name: "T1 outside air",
            DPInfo: "TEMPERATURE",
            TypeName: "VARDP",
            ValueMin: null,
            ValueMax: null,
            ValueUnit: "°C",
            ValueType: 4,
            Parent: settings.adapters.pluggit.firstId
            //_persistent: true
        });

    setObject(settings.adapters.pluggit.firstId+11,
    {
        Name: "T2 supply air",
        DPInfo: "TEMPERATURE",
        TypeName: "VARDP",
        ValueMin: null,
        ValueMax: null,
        ValueUnit: "°C",
        ValueType: 4,
        Parent: settings.adapters.pluggit.firstId
        //_persistent: true
    });

    setObject(settings.adapters.pluggit.firstId+12,
    {
        Name: "T3 exhaust air",
        DPInfo: "TEMPERATURE",
        TypeName: "VARDP",
        ValueMin: null,
        ValueMax: null,
        ValueUnit: "°C",
        ValueType: 4,
        Parent: settings.adapters.pluggit.firstId
        //_persistent: true
    });

    setObject(settings.adapters.pluggit.firstId+13,
    {
        Name: "T4 outgoing air",
        DPInfo: "TEMPERATURE",
        TypeName: "VARDP",
        ValueMin: null,
        ValueMax: null,
        ValueUnit: "°C",
        ValueType: 4,
        Parent: settings.adapters.pluggit.firstId
        //_persistent: true
    });

    setObject(settings.adapters.pluggit.firstId+14,
        {
            Name: "T5 room",
            DPInfo: "TEMPERATURE",
            TypeName: "VARDP",
            ValueMin: null,
            ValueMax: null,
            ValueUnit: "°C",
            ValueType: 4,
            Parent: settings.adapters.pluggit.firstId
            //_persistent: true
        });

    setObject(settings.adapters.pluggit.firstId+20,
        {
            Name: "filter period",
            DPInfo: "FILTER",
            TypeName: "VARDP",
            ValueMin: null,
            ValueMax: null,
            ValueUnit: "month",
            ValueType: 2,
            Parent: settings.adapters.pluggit.firstId
            //_persistent: true
        });

    setObject(settings.adapters.pluggit.firstId+21,
        {
            Name: "filter reset",
            DPInfo: "FILTER",
            TypeName: "VARDP",
            ValueMin: null,
            ValueMax: null,
            ValueUnit: "days",
            ValueType: 2,
            Parent: settings.adapters.pluggit.firstId
            //_persistent: true
        });

    setObject(settings.adapters.pluggit.firstId+22,
        {
            Name: "rel. humidity",
            DPInfo: "SENSOR",
            TypeName: "VARDP",
            ValueMin: null,
            ValueMax: null,
            ValueUnit: "%",
            ValueType: 2,
            Parent: settings.adapters.pluggit.firstId
            //_persistent: true
        });

    setObject(settings.adapters.pluggit.firstId+23,
        {
            Name: "bypass",
            DPInfo: "BYPASS",
            TypeName: "VARDP",
            ValueMin: null,
            ValueMax: null,
            ValueUnit: "",
            ValueType: 2,
            Parent: settings.adapters.pluggit.firstId
            //_persistent: true
        });

    setObject(settings.adapters.pluggit.firstId+24,
        {
            Name: "bypass state",
            DPInfo: "BYPASS",
            TypeName: "VARDP",
            ValueMin: null,
            ValueMax: null,
            ValueUnit: "",
            ValueType: 20,
            Parent: settings.adapters.pluggit.firstId
            //_persistent: true
        });

    setObject(settings.adapters.pluggit.firstId+25,
        {
            Name: "ventilation speed",
            DPInfo: "VENTILATOR",
            TypeName: "VARDP",
            ValueMin: null,
            ValueMax: null,
            ValueUnit: "",
            ValueType: 2,
            Parent: settings.adapters.pluggit.firstId
            //_persistent: true
        });

    setObject(settings.adapters.pluggit.firstId+30,
        {
            Name: "alarm",
            DPInfo: "ALARM",
            TypeName: "VARDP",
            ValueMin: null,
            ValueMax: null,
            ValueUnit: "",
            ValueType: 2,
            Parent: settings.adapters.pluggit.firstId
            //_persistent: true
        });

    setObject(settings.adapters.pluggit.firstId+31,
        {
            Name: "alarm state",
            DPInfo: "ALARM",
            TypeName: "VARDP",
            ValueMin: null,
            ValueMax: null,
            ValueUnit: "",
            ValueType: 20,
            Parent: settings.adapters.pluggit.firstId
            //_persistent: true
        });

    setObject(settings.adapters.pluggit.firstId+40,
        {
            Name: "work time",
            DPInfo: "INFO",
            TypeName: "VARDP",
            ValueMin: null,
            ValueMax: null,
            ValueUnit: "",
            ValueType: 16,
            Parent: settings.adapters.pluggit.firstId
            //_persistent: true
        });
}

/* store data in database */
function storeDatabase(timestamp, dp)
{
    /* is mysql adapter defined? */
    if ((typeof settings.adapters.pluggit.settings.mysql)!='undefined')
    {
        /* build sql command */
        var sql = "INSERT INTO pluggit VALUES (" + timestamp +",";
        sql += '\''+dp['name']+'\','+dp['serial']+','+dp['version']+',';
        sql += dp['t1']+','+dp['t2']+','+dp['t3']+','+dp['t4']+','+dp['t5']+',';
        sql += dp['filter']+','+dp['filterReset']+','+dp['humidity']+',\''+dp['bypassState']+'\',';
        sql += '\''+dp['alarmState']+'\','+dp['speed']+','+dp['workTime']+')';
        dbgout(sql);

        /* connect to mysql database */
        var mysql = require('mysql');
        var client = mysql.createConnection(
            {
                host: settings.adapters.pluggit.settings.mysql.host,
                user: settings.adapters.pluggit.settings.mysql.user,
                password: settings.adapters.pluggit.settings.mysql.pass
            });

        client.connect(function(err)
        {
            if (err)
            {
                logger.error("adapter pluggit can't connect to mysql-server "+err);
                stop();
            }

            dbgout("adapter pluggit connected to mysql-server on "+settings.adapters.pluggit.settings.mysql.host);
        });

        /* select database and insert data */
        client.query('USE '+settings.adapters.pluggit.settings.mysql.database);
        client.query(sql);
        /* close database */
        client.end();
    }
}
