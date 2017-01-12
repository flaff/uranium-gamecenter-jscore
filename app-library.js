var http = require('http'),
    fs = require('fs'),

    directory = 'app-library/',
    appsFile = '_apps',
    summaryFile = '_summary',
    ext = '.json',
    encoding = 'utf8',

    steamHost = 'store.steampowered.com',
    steamPath = '/api/appdetails?language=polish&appids=';


function AppLibrary () {}

var parseSteamAppToSummary = function (appid, data) {
    var result = {};

    if(data[appid] && data[appid].success) {
        data = data[appid].data;

        result.name = data.name;
        result.appid = appid;
        result.controller = data['controller_support'];
        result.cover = data['header_image'];
        result.categories = data.categories;
        result.genres = data.genres;
        result.background = data.background;

        return result;

    } else {
        // empty object, wrong data?
        return false;
    }
};

AppLibrary.prototype.getSummary = function (callback) {
    fs.readFile(directory + summaryFile + ext, function (error, data) {
        if(error) {
            callback(JSON.stringify({'result':'notfound'}));
        } else {
            callback(data);
        }
    });
};

AppLibrary.prototype.addToSummary = function (appid, appdata) {

    fs.readFile(directory + summaryFile + ext, function (error, data) {
        if(error) {
            console.log('error adding to summary:', appid, error);
            return;
        }


        appdata = parseSteamAppToSummary(appid, JSON.parse(appdata));
        data = JSON.parse(data);
        if(appdata) {
            data.steamApps.push(appdata);
            fs.writeFile(directory + summaryFile + ext, JSON.stringify(data), encoding, function (e) {
                if(e) console.log('error updating summary', appid, e);
                else console.log('updated summary');
            });
        }
    });
};

AppLibrary.prototype.removeFromSummary = function (appid) {
    var i, found = -1, swap;
    fs.readFile(directory + summaryFile + ext, function (error, data) {
        if(error) {
            console.log('error reading summary:', appid, error);
            return;
        }
        data = JSON.parse(data);

        if(!data.steamApps){
            swap = {steamApps: data};
            data = swap;
        }


        for(i = 0; i < data.steamApps.length; i++) {
            if(data.steamApps[i].appid === appid) {
                found = i;
                break;
            }
        }

        if(found !== -1) {
            data.steamApps.splice(found, 1);
            fs.writeFile(directory + summaryFile + ext, JSON.stringify(data), encoding, function (e) {
                if(e) console.log('error updating summary (removal)', appid, e);
                else console.log('updated summary');
            });
        }
    });
};

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
    this.removeFromSummary(appid);
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
                self.addToSummary(appid, data);
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