
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes');

var app = module.exports = express.createServer();

// Configuration

app.configure(function(){
    app.set('views', __dirname + '/views');
    app.set('view engine', 'ejs');
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(app.router);
    app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
    app.use(express.errorHandler());
});

// Routes

app.get('/', routes.index);

app.listen(11111, function(){
    console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
});



// ===========================================
// Config
var appDirPath = '/home/nakatani/dddfs_vis';


// Utility functions
var log = console.log;
var getReplConn = function(sqliteOutput) {
    if (sqliteOutput == undefined) return [];

    var ret = [];
    records = sqliteOutput.split('\n');
    records.map(function(record) {
        if (record != '') {
            var col = record.split('|');
            var tracedFileSplitByPath = col[0].split('/');
            ret.push({
                file: tracedFileSplitByPath.pop(),
                ip: col[1],
                nConn: parseInt(col[2]),
            });
        }
    });
    return ret;
}


// Requires
var md = require(appDirPath + '/public/javascripts/metadata.server.js');
var fs = require('fs');
var child_process = require('child_process');

// Startup logging
log ('[Traced Files]');
log(md.tracedFiles);


// Polling for metadata and replConn
var mdInfo = {}; // This assosiative array is sent to clients
var replConn = []; // This array is sent to clients
var polling = setInterval(function() {
    // Read the contents of tracedFile and push into mdInfo
    md.tracedFiles.map(function(tracedFile) {
        fs.readFile(md.mdDirPath + '/' + tracedFile, 'utf8', function(err, data) {
            // TODO: deal with the situation where trace[ABC] is not exsits
            if (err) throw err;
            mdInfo[tracedFile] = data;
        });
   });

    // Read the connection count from DB
    var cmd = 'sqlite3 ' + md.replicaConnDb +
        ' "SELECT * FROM access_table;"';
    child_process.exec(cmd, function(err, stdout, stderr) {
        if (err) throw err;
        replConn = getReplConn(stdout);
    });
}, 1000);


// Create socket listening to app
var socketIO = require('socket.io');
var io = socketIO.listen(app);


// When a client connets to me:
io.sockets.on('connection', function(socket) {
    log("[connection]");

    // Process initial request for md info
    socket.on('req md info init', function(client) {
        log('[MD info Request from ' + client.sessionId + ']');
        socket.emit('md info init', mdInfo);
    });

    // Process request for iptable
    socket.on('req iptable', function(client) {
        log('[Iptable Request from ' + client.sessionId + ']');
        fs.readFile(appDirPath + '/public/json/iptable.json', 'utf8', function(err, data) {
            if (err) throw err;
            socket.emit('iptable', eval(JSON.parse(data)));
        });
    });

    // Process request for cluster geometoric info
    socket.on('req cluster geo', function(client) {
        log('[Cluster Geometoric info Request from ' + client.sessionId + ']');
        fs.readFile(appDirPath + '/public/json/cluster.geometory.json', 'utf8', function(err, data) {
            if (err) throw err;
            socket.emit('cluster geo', eval(JSON.parse(data)));
        });
    });

    // Process request for md info
    socket.on('req md info', function(client) {
        log('[MD info Request from ' + client.sessionId + ']');
        socket.emit('md info', mdInfo);
    });

    // Process request for repl conn
    socket.on('req repl conn', function(client) {
        log('[Replication connection Request from ' + client.sessionId + ']');
        socket.emit('repl conn', replConn);
    });

    // When the client disconnects from me:
    socket.on('disconnect', function(){
        log("[disconnect]");
    });
});
