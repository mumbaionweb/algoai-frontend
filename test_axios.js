const axios = require('axios');
const FormData = require('form-data');

const apiClient = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(config => {
  console.log('Headers:', config.headers);
  return config;
});

const form = new FormData();
form.append('file', 'dummy content', 'test.csv');

apiClient.post('http://localhost:8080/api/transactions/upload', form).catch(e => {
  console.log('Error status:', e.response?.status);
});
