import https from 'https';

https.get('https://script.google.com/macros/s/AKfycbyGtfNgLdduKu5UfeSj5tVo4A3OmJQy_5s4B33BsPTpJ8z_eK0hYH01bED-UJ08mKV4/exec', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      https.get(res.headers.location, (res2) => {
        let data2 = '';
        res2.on('data', chunk => data2 += chunk);
        res2.on('end', () => {
          const json = JSON.parse(data2);
          const teams = new Set();
          Object.keys(json).forEach(k => {
            if (Array.isArray(json[k])) {
              json[k].forEach(g => {
                if (g.HomeTeam) teams.add(g.HomeTeam);
              });
            }
          });
          console.log(Array.from(teams).sort());
        });
      });
    }
  });
});
