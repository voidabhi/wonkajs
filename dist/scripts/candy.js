var fs = require('fs'),
    path = require('path'),
    exec = require('child_process').exec,
    utils = require('../lib/utils.js');

var CANDIES_HOST = 'candiesapi.rcchristiane.com.mx';

var existsSync = fs.existsSync || path.existsSync;

var githubClone = function(user, repo, name) {
  var projectDir = process.cwd();

  var pkgPath = path.join(projectDir, 'package.json');
  var pkg = JSON.parse(fs.readFileSync(pkgPath).toString());

  var modulePath = path.join(projectDir, name);

  var GitHubApi = require("github");

  var github = new GitHubApi({
      version: "3.0.0",
      timeout: 5000
  });

  var copyLibraries = function(pkgMod) {
    var libs = pkgMod.libraries;
    for(var i in libs) {
      var src = path.join(modulePath, 'libraries', libs[i] + '.js');
      var dest = path.join(projectDir, 'libraries', libs[i] + '.js');
      utils.copy(src, dest);
      if (pkg.settings.environment.libraries.indexOf(libs[i]) == -1) {
        pkg.settings.environment.libraries.push(libs[i]);
      }
    }
  }

  var copyResources = function(pkgMod) {
    for (var resource in pkgMod.resources) {
      for (var item in pkgMod.resources[resource]) {
        var orig = path.join(modulePath, resource)
        if (!existsSync(path.join(projectDir, resource))) {
          fs.mkdirSync(path.join(projectDir, resource), '0755');
        }
        var dest = path.join(projectDir, resource, pkgMod.resources[resource][item]);
        utils.copy(orig, dest);
      }
    }
  }

  github.repos.get({
    'user': user,
    'repo': repo.replace('.git', '')
  }, function(a, info) {
    exec('git clone ' + info.clone_url.replace('.git', '') + ' ' + name, function() {

      var pkgModPath = path.join(projectDir, name, 'package.json');
      var pkgMod = JSON.parse(fs.readFileSync(pkgModPath).toString());
      copyLibraries(pkgMod);
      copyResources(pkgMod);
      var initFile = path.join(modulePath, 'init.js');
      var readme = fs.readFileSync(path.join(projectDir, name, 'README.md')).toString();

      if (existsSync(initFile)) {
        if (pkg.settings.environment.applications.indexOf(name) == -1) {
          pkg.settings.environment.applications.push(name);
        }
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

        fs.unlinkSync(path.join(modulePath, 'package.json'));
        try {
          fs.unlinkSync(path.join(modulePath, 'README.md'));
        } catch(e) {}
      } else {
        utils.rmdirRecursiveSync(modulePath);
      }

      console.log('The candy ' + name + ' has been downloaded');

      console.log('Read the docs http://github.com/' + user + '/' + repo.replace('.git', '') + '/blob/master/README.md');
      
    });
  });
}

var getCandy = function(name, callback) {
  var http = require('http');

  var options = {
    host: CANDIES_HOST,
    path: '/candies/candy/' + name,
    method: 'GET'
  };

  var request = http.request(options, function(response) {
    response.on('data', function(chunk) {
      var candy = JSON.parse(chunk);
      if (candy.hasOwnProperty('Candy')) {
        callback(candy.Candy.url);
      } else {
        console.info('Sorry, but', name, 'candy was not found!');
      }
    });
  });
  request.end();
}

module.exports.builder = function(name) {
  getCandy(name, function(githubURL) {

    var urlComs = githubURL.replace('https://', '').replace('http://', '').split('/');

    var user = urlComs[1];

    var repo = urlComs[2];

    var https = require('https');
    
    var options = {
      host : 'raw.github.com',
      path : '/' + user + '/' + repo.replace('.git', '') + '/master/package.json',
      method : 'GET'
    };

    var request = https.request(options, function(response) {
      var body = '';
      response.on('data', function(chunk) {
        var pkg = JSON.parse(chunk);
        if (pkg.name == name) {
          githubClone(user, repo, name);
        }
      });  
    });  
    request.end();
  });
}
