/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

interface Env {
  tracker: KVNamespace;
}

type CleanCfProperties<T> = Pick<
  CfProperties<T>,
  | 'longitude'
  | 'latitude'
  | 'country'
  | 'city'
  | 'timezone'
  | 'colo'
  | 'postalCode'
  | 'region'
  | 'regionCode'
  | 'asOrganization'
  | 'metroCode'
> & { userAgent: string };

type personMapInfo = {
  type: 'Feature';
  properties: {
    ip: string;
    user_agent: string;
    visit_count: number;
    orginization: string;
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
};

type geoJson = {
  type: 'FeatureCollection';
  features: personMapInfo[];
};

const map = (trash: geoJson) => {
  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>6mp page tracker</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script src="https://api.tiles.mapbox.com/mapbox-gl-js/v3.1.0/mapbox-gl.js"></script>
    <link
      href="https://api.tiles.mapbox.com/mapbox-gl-js/v3.1.0/mapbox-gl.css"
      rel="stylesheet"
    />
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: Arial, sans-serif;
      }

      #map {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 100%;
      }

      .map-overlay {
        position: absolute;
        top: 20px;
        left: 0;
        right: 0;
        z-index: 1;
        text-align: center;
        color: #fff;
        font-size: 24px;
        font-weight: bold;
        text-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <div class="map-overlay">GitHub profile visitors</div>
    <script>
      mapboxgl.accessToken = 'pk.eyJ1IjoiNm1wIiwiYSI6ImNsdjc0eTF2ejA2ZjMyaW55aXZjODZqcHkifQ.wdzHoF6AIAD8N7IZXO7iWA';
      const map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [-79.999732, 40.4374],
        zoom: 5
      });
      map.on('load', () => {
        map.addSource('trees', {
          'type': 'geojson',
          'data': ${JSON.stringify(trash)}
        });

        map.addLayer(
          {
            'id': 'trees-heat',
            'type': 'heatmap',
            'source': 'trees',
            'maxzoom': 15,
            'paint': {
              // increase intensity as zoom level increases
              'heatmap-intensity': {
                'stops': [
                  [11, 1],
                  [15, 3]
                ]
              },
              // use sequential color palette to use exponentially as the weight increases
              'heatmap-color': [
                'interpolate',
                ['linear'],
                ['heatmap-density'],
                0,
                'rgba(236,222,239,0)',
                0.2,
                'rgb(208,209,230)',
                0.4,
                'rgb(166,189,219)',
                0.6,
                'rgb(103,169,207)',
                0.8,
                'rgb(28,144,153)'
              ],
              // increase radius as zoom increases
              'heatmap-radius': {
                'stops': [
                  [11, 15],
                  [15, 20]
                ]
              },
              // decrease opacity to transition into the circle layer
              'heatmap-opacity': {
                'default': 1,
                'stops': [
                  [14, 1],
                  [15, 0]
                ]
              }
            }
          },
          'waterway-label'
        );

        map.addLayer(
          {
            'id': 'trees-point',
            'type': 'circle',
            'source': 'trees',
            'minzoom': 14,
            'paint': {
              // increase the radius of the circle as the zoom level and dbh value increases
              'circle-radius': {
                'property': 'view_count',
                'type': 'exponential',
                'stops': [
                  [{ zoom: 15, value: 1 }, 5],
                  [{ zoom: 15, value: 62 }, 10],
                  [{ zoom: 22, value: 1 }, 20],
                  [{ zoom: 22, value: 62 }, 50]
                ]
              },
              'circle-color': {
                'property': 'view_count',
                'type': 'exponential',
                'stops': [
                  [0, 'rgba(236,222,239,0)'],
                  [10, 'rgb(236,222,239)'],
                  [20, 'rgb(208,209,230)'],
                  [30, 'rgb(166,189,219)'],
                  [40, 'rgb(103,169,207)'],
                  [50, 'rgb(28,144,153)'],
                  [60, 'rgb(1,108,89)']
                ]
              },
              'circle-stroke-color': 'white',
              'circle-stroke-width': 1,
              'circle-opacity': {
                'stops': [
                  [14, 0],
                  [15, 1]
                ]
              }
            }
          },
          'waterway-label'
        );
      });

      // click on tree to view dbh in a popup
      map.on('click', 'trees-point', (event) => {
        new mapboxgl.Popup()
          .setLngLat(event.features[0].geometry.coordinates)
          .setHTML("<strong>IP:</strong> " + event.features[0].properties.ip + "<br><strong>Visit Count:</strong> " + event.features[0].properties.visit_count + "<br><strong>Last User Agent:</strong> " + event.features[0].properties.user_agent + "<br><strong>Orginization:</strong> " + event.features[0].properties.orginization)
          .addTo(map);
      });
    </script>
  </body>
</html>`;
};

interface PersonInfo {
  // all the things in the cf object
  info: CleanCfProperties<unknown>;
  count: number;
}


async function getStuff(env: Env) {
  let keys = (await env.tracker.list()).keys;

  let trash: geoJson = {
    type: 'FeatureCollection',
    features: [],
  };

  for (let key of keys) {
    let value = await env.tracker.get<PersonInfo>(key.name, 'json');
    if (value) {
      trash.features.push({
        type: 'Feature',
        properties: {
          ip: key.name,
          user_agent: value.info.userAgent,
          visit_count: value.count,
          orginization: value.info.asOrganization as string,
        },
        geometry: {
          type: 'Point',
          coordinates: [value.info.longitude as number, value.info.latitude as number],
        },
      });
    }
  }

  return trash;
}

async function iconTracker(request: Request, env: Env): Promise<Response> {
  const ip = request.headers.get('CF-Connecting-IP');
  const userAgent = request.headers.get('User-Agent');
  const personInfo = request.cf;

  if (!ip || !personInfo || !userAgent) {
    return new Response('not dealing with this thing', { status: 400 });
  }

  let info: CleanCfProperties<unknown> = {
    timezone: personInfo.timezone,
    latitude: personInfo.latitude,
    longitude: personInfo.longitude,
    country: personInfo.country,
    city: personInfo.city,
    colo: personInfo.colo,
    postalCode: personInfo.postalCode,
    region: personInfo.region,
    regionCode: personInfo.regionCode,
    asOrganization: personInfo.asOrganization,
    metroCode: personInfo.metroCode,
    userAgent,
  };

  // kv is ip -> {info, count}
  const key = ip;
  let value = await env.tracker.get<PersonInfo>(key, 'json');
  if (value) {
    // update stuff
    value.info = info;
    value.count++;
  } else {
    value = {
      info,
      count: 1,
    };
  }

  // if people start looking at this i can do this
  await env.tracker.put(key, JSON.stringify(value) /* , { expirationTtl: 60 * 60 * 24 * 7 } */);

  return new Response(
    `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <circle cx="50" cy="50" r="40" stroke="black" stroke-width="3" fill="red" />
    </svg>`
  );
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    let path = new URL(request.url).pathname;
    switch (path) {
      case '/thing.svg':
        return iconTracker(request, env);
      default:
        await iconTracker(request, env);

        return new Response(map(await getStuff(env)), {
          headers: {
            'content-type': 'text/html',
          },
        });
    }
  },
};
