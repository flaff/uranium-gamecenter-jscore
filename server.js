var express = require('express'),
    http = require('http'),
    fs = require('fs'),
    app = express(),
    AppLibrary = require('./app-library'),
    server,
    port = 3141;

var appLibrary = new AppLibrary();

app.get('/steam-search/:query', function (request, response) {
    appLibrary.query(request.params.query, function (result) {
        response.writeHead(200, {'Content-Type': 'text/plain', 'Access-Control-Allow-Origin' : '*' });
        response.end(result);
    });
});

app.get('/steam-apps', function (request, response) {
    appLibrary.getSummary(function (data) {
        response.writeHead(200, {'Content-Type': 'text/plain', 'Access-Control-Allow-Origin' : '*' });
        response.end(data);
    });
});

app.get('/steam-apps/:appid', function (request, response) {
    appLibrary.getSteamApp(request.params.appid, function (data) {
        response.writeHead(200, {'Content-Type': 'text/plain', 'Access-Control-Allow-Origin' : '*' });
        response.end(data);
    });
});

app.get('/steam-apps/add/:appid', function (request, response) {
    appLibrary.addSteamApp(request.params.appid, function (data) {
        response.writeHead(200, {'Content-Type': 'text/plain', 'Access-Control-Allow-Origin' : '*' });
        response.end(data);
    });
});

app.get('/steam-apps/remove/:appid', function (request, response) {
    appLibrary.removeSteamApp(request.params.appid, function (data) {
        response.writeHead(200, {'Content-Type': 'text/plain', 'Access-Control-Allow-Origin' : '*' });
        response.end(data);
    });
});

server = app.listen(port, function () {
    console.log('server started');
});