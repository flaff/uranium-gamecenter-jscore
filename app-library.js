var http = require('http'),
    fs = require('fs'),
    htj = require('html-to-json'),

    directory = './app-library/',
    appsFile = '_apps',
    summaryFile = '_summary',
    ext = '.json',
    encoding = 'utf8',

    steamHost = 'store.steampowered.com',
    steamPath = '/api/appdetails?language=polish&appids=',
    steamQueryPath = '/search/suggest?f=games&cc=PL&l=polish&term=',

    _apps = [];


function AppLibrary () {
    // restore _apps
    fs.readFile(directory + appsFile + ext, function (error, data) {
        if (error) {
            console.log('read error @', directory + appsFile + ext, error);
            data = {steamApps: []};
        } else {
            data = JSON.parse(data);
        }
        _apps = data.steamApps;
    });
}

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

function parseQueryResult (data) {
    var parsed = [], i, len;
    if(!data || !data.images) {
        return {'result': 'parsing_error'};
    }

    len = data.images.length;
    for(i = 0; i < len; i++) {
        parsed.push({
            appid: data.appids[i],
            name: data.names[i],
            cover: data.images[i],
            price: data.prices[i],
            inLibrary: _apps.indexOf(data.appids[i]) !== -1
        });
    }
    return parsed;
}

AppLibrary.prototype.query = function (query, callback) {
    var parseOptions = {
            'images': ['img', function (dom) { return dom.attr('src') }],
            'names': ['.match_name', function (dom) { return dom.text() }],
            'appids': ['.ds_collapse_flag', function (dom) { return dom.attr('data-ds-appid') }],
            'prices': ['.match_price', function (dom) { return dom.text() }]
        };

    console.log('making query request', steamHost + steamQueryPath + query);


    htj.request('http://' + steamHost + steamQueryPath + query, parseOptions, function (error, data) {
        callback(JSON.stringify({suggestions: parseQueryResult(data)}));
    });
};

AppLibrary.prototype.getSummary = function (callback) {
    fs.readFile(directory + summaryFile + ext, function (error, data) {
        if(error) {
            console.log('getSummary readFile error', error);
            // callback(JSON.stringify({'result':'notfound'}));
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
            // add
            data.steamApps.push(appdata);

            // sort
            data.steamApps.sort(function (a,b) {
                if (a.name.toLowerCase() < b.name.toLowerCase()) {
                    return -1;
                } else if (a.name.toLowerCase() > b.name.toLowerCase()) {
                    return 1;
                }
                return 0;
            });
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

        for(i = 0; i < data.steamApps.length; i++) {
            if(data.steamApps[i].appid === appid) {
                found = i;
                break;
            }
        }

        if(found !== -1) {
            // remove
            data.steamApps.splice(found, 1);

            // sort
            // data.steamApps.sort(function (a,b) {
            //     if (a.name.toLowerCase() < b.name.toLowerCase()) {
            //         return -1;
            //     } else if (a.name.toLowerCase() > b.name.toLowerCase()) {
            //         return 1;
            //     }
            //     return 0;
            // });
            fs.writeFile(directory + summaryFile + ext, JSON.stringify(data), encoding, function (e) {
                if(e) console.log('error updating summary (removal)', appid, e);
                else console.log('updated summary');
            });
        }
    });
};

AppLibrary.prototype.setLocalSteamApp = function (appid, data, callback) {
    var self = this, localCallback;
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
                _apps = data.steamApps;

                if(data.steamApps.indexOf(appid) === -1) {
                    data.steamApps.push(appid);
                    fs.writeFile(directory + appsFile + ext, JSON.stringify(data), function (e) {
                        if (e) {
                            console.log('failed to update', directory + appsFile + ext, ', appid:', appid);
                        } else {
                            console.log('successfully updated list:', appsFile);
                            localCallback = function (data) {
                                callback(JSON.stringify({result: 'success', steamApps: JSON.parse(data).steamApps}));
                            };
                            self.getSummary(localCallback);
                        }
                    });
                } else {
                    console.log('app was already cached (skipping update _apps)');
                    localCallback = function (data) {
                        callback(JSON.stringify({result: 'success', steamApps: JSON.parse(data).steamApps}));
                    };
                    self.getSummary(localCallback);
                }
            })
        }
    });
};

AppLibrary.prototype.removeSteamApp = function (appid, callback) {
    var localCallback, self = this;

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
        _apps = data.steamApps;

        if(data.steamApps.indexOf(appid) !== -1) {
            data.steamApps.splice(data.steamApps.indexOf(appid), 1);
            fs.writeFile(directory + appsFile + ext, JSON.stringify(data), function (e) {
                if (e) {
                    console.log('failed to update', directory + appsFile + ext, ', appid:', appid);
                } else {
                    console.log('successfully updated list (removal of '+appid+'):', appsFile);

                    localCallback = function (data) {
                        callback(JSON.stringify({result: 'success', steamApps: JSON.parse(data).steamApps}));
                    };
                    self.getSummary(localCallback);
                }
            });
        } else {
            console.log('app was already removed (skipping update _apps)');

            localCallback = function (data) {
                callback(JSON.stringify({result: 'success', steamApps: JSON.parse(data).steamApps}));
            };
            self.getSummary(localCallback);
        }
    })
};


AppLibrary.prototype.addSteamApp = function (appid, callback) {
    var self = this, localCallback;
    fs.readFile(directory + appid + ext, encoding, function (error, data) {
        if (error) {
            console.log('not found, downloading:', appid);
            self.fetchSteamApp(appid, function (data) {
                self.addToSummary(appid, data);
                self.setLocalSteamApp(appid, data, callback);
            });
        } else {
            console.log('found local copy of', appid);
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