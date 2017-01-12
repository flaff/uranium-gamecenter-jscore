var http = require('http'),
    fs = require('fs'),

    directory = 'app-library/',
    appsFile = '_apps',
    ext = '.json',
    encoding = 'utf8',

    steamHost = 'store.steampowered.com',
    steamPath = '/api/appdetails?language=polish&appids=';


function AppLibrary () {}

AppLibrary.prototype.setLocalSteamApp = function (appid, data) {
    // stworz plik steamApp po appid
    fs.writeFile(directory + appid + ext, data, encoding, function (e) {
        if (e) {
            console.log('write error @', directory + appid + ext, e);
        } else {
            console.log('successfully cached app:', appid);
            console.log('updating', appsFile);
            // zaktualizuj _apps - pobieranie starych wartosci
            fs.readFile(directory + appsFile + ext, function (error, data) {
                if(error) {
                    console.log('read error @', directory + appsFile + ext, error);
                    data = {steamApps: []};
                }
                // zaktualizuj _apps - aktualizacja, dodawanie nowego appid
                data = JSON.parse(data);
                if(data.steamApps.indexOf(appid) === -1) {
                    data.steamApps.push(appid);
                    fs.writeFile(directory + appsFile + ext, JSON.stringify(data), function (e) {
                        if (e) {
                            console.log('failed to update', directory + appsFile + ext, ', appid:', appid);
                        } else {
                            console.log('successfully updated list:', appsFile);
                        }
                    });
                } else {
                    console.log('app was already cached (skipping update _apps)');
                }
            })
        }
    });
};

AppLibrary.prototype.removeSteamApp = function (appid, callback) {
    fs.unlink(directory + appid + ext, function (error) {
        if(error) console.log('error removing file', appid, '(not found)');
    });
    fs.readFile(directory + appsFile + ext, function (error, data) {
        if(error) {
            console.log('read error @', directory + appsFile + ext, error);
        }
        // zaktualizuj _apps - aktualizacja, dodawanie nowego appid
        data = JSON.parse(data);
        if(data.steamApps.indexOf(appid) !== -1) {
            data.steamApps.splice(data.steamApps.indexOf(appid), 1);
            fs.writeFile(directory + appsFile + ext, JSON.stringify(data), function (e) {
                if (e) {
                    console.log('failed to update', directory + appsFile + ext, ', appid:', appid);
                } else {
                    console.log('successfully updated list (removal of '+appid+'):', appsFile);
                }
            });
        } else {
            console.log('app was already removed (skipping update _apps)');
            callback(JSON.stringify({'result': 'notfound'}));
        }
    })
};


AppLibrary.prototype.addSteamApp = function (appid, callback) {
    var self = this;
    fs.readFile(directory + appid + ext, encoding, function (error, data) {
        if (error) {
            console.log('not found, downloading:', appid);
            self.fetchSteamApp(appid, function (data) {
                self.setLocalSteamApp(appid, data);
                callback(data);
            });
        } else {
            console.log('found local copy of', appid);
            callback(data);
        }
    });
};


AppLibrary.prototype.getSteamApp = function (appid, callback) {
    var self = this;
    fs.readFile(directory + appid + ext, encoding, function (error, data) {
        if (error) {
            console.log('not found:', appid);
            callback(JSON.stringify({'result': 'notfound'}));
        } else {
            callback(data);
        }
    });
};


AppLibrary.prototype.fetchSteamApp = function (appid, callback) {
    var options = { host: steamHost, path: steamPath + appid },
        result = '';

    console.log('making request:', appid);

    var internalCallback = function(steamResponse) {
        steamResponse.on('data', function (data) { result += data });
        steamResponse.on('end', function () { callback(result) });
    };

    http.request(options, internalCallback).end();
};

module.exports = AppLibrary;