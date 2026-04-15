const fetch = require('node-fetch');
fetch('https://script.google.com/macros/s/AKfycbyGtfNgLdduKu5UfeSj5tVo4A3OmJQy_5s4B33BsPTpJ8z_eK0hYH01bED-UJ08mKV4/exec')
  .then(res => res.json())
  .then(data => {
    console.log('Keys:', Object.keys(data));
    const igKey = Object.keys(data).find(k => k.toLowerCase() === 'cheerleadersig' || k === '啦啦隊ig' || k === '啦啦隊IG');
    console.log('Found IG Key:', igKey);
    if (igKey) {
      console.log('IG Data sample:', data[igKey].slice(0, 2));
    }
  });
