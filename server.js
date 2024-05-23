const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');
const os = require('os'); // Import os module to get the temp directory
const tempDir = os.tmpdir(); // Get the system temp directory
const app = express();
const port = 8080;

app.use(bodyParser.json());

const DATA_PATH = path.join(__dirname, 'addresses.json');

let cities = [];

// Load cities data from addresses.json
fs.readJson(DATA_PATH)
    .then(data => {
        cities = data;
    })
    .catch(err => {
        console.error('Error reading addresses.json:', err);
    });

const authenticate = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (authHeader === 'bearer dGhlc2VjcmV0dG9rZW4=') {
        next();
    } else {
        res.sendStatus(401);
    }
};

const haversineDistance = (coords1, coords2) => {
    const toRad = x => (x * Math.PI) / 180;

    const lat1 = coords1.latitude;
    const lon1 = coords1.longitude;
    const lat2 = coords2.latitude;
    const lon2 = coords2.longitude;

    const R = 6371; // Earth radius in kilometers
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
};

app.get('/cities-by-tag', authenticate, (req, res) => {
    const {
        tag,
        isActive
    } = req.query;
    const filteredCities = cities.filter(city => city.tags.includes(tag) && city.isActive === (isActive === 'true'));
    res.json({
        cities: filteredCities
    });
});

app.get('/distance', authenticate, (req, res) => {
    const {
        from,
        to
    } = req.query;
    const cityFrom = cities.find(city => city.guid === from);
    const cityTo = cities.find(city => city.guid === to);

    if (!cityFrom || !cityTo) {
        return res.sendStatus(404);
    }

    const distance = haversineDistance({
        latitude: cityFrom.latitude,
        longitude: cityFrom.longitude
    }, {
        latitude: cityTo.latitude,
        longitude: cityTo.longitude
    });

    res.json({
        from: cityFrom,
        to: cityTo,
        unit: 'km',
        distance: parseFloat(distance.toFixed(2))
    });
});

const areaResults = {};

app.get('/area', authenticate, (req, res) => {
    const {
        from,
        distance
    } = req.query;
    const cityFrom = cities.find(city => city.guid === from);

    if (!cityFrom) {
        return res.sendStatus(404);
    }

    const resultId = "2152f96f-50c7-4d76-9e18-f7033bd14428"; // Generate a unique ID for this request

    // Simulate asynchronous processing
    setTimeout(() => {
        const nearbyCities = cities.filter(city => {
            if (city.guid === from) return false; // Exclude the city specified by 'from'

            const dist = haversineDistance({
                latitude: cityFrom.latitude,
                longitude: cityFrom.longitude
            }, {
                latitude: city.latitude,
                longitude: city.longitude
            });
            return dist <= parseFloat(distance); // Ensure distance is treated as a number
        });

        console.log(`Found ${nearbyCities.length} nearby cities within ${distance} km of ${cityFrom.guid}`);
        areaResults[resultId] = nearbyCities;
    }, 2000); // Delay of 2 seconds for simulation

    res.status(202).json({
        resultsUrl: `${req.protocol}://${req.get('host')}/area-result/${resultId}`
    });
});

app.get('/area-result/:id', authenticate, (req, res) => {
    const {
        id
    } = req.params;
    const result = areaResults[id];

    if (result) {
        res.json({
            cities: result
        });
    } else {
        res.sendStatus(202); // Result not ready yet
    }
});



app.get('/all-cities', authenticate, (req, res) => {
    const filePath = path.join(tempDir, 'all-cities.json');

    fs.writeJson(filePath, cities, {
            spaces: 2
        })
        .then(() => {
            res.setHeader('Content-Type', 'application/json');
            const readStream = fs.createReadStream(filePath);
            readStream.pipe(res);
        })
        .catch(err => {
            res.status(500).json({
                error: 'Failed to stream cities data',
                details: err.message
            });
        });
});


app.listen(port, () => {
    console.log(`Server running at http://127.0.0.1:${port}`);
});