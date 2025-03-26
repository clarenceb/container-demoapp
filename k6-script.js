import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '20s', target: 10 },
    { duration: '3m', target: 50 },
    { duration: '20s', target: 0 },
  ],
};

export default function() {
  // Retrieve the host name from the environment variable TARGET_HOST;
  // otherwise defaults to http://localhost:8080/
  let host = __ENV.TARGET_HOST || 'http://localhost:8080/';
  let res = http.get(host);
  check(res, { 'status was 200': r => r.status == 200 });
}