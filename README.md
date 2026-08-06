[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/sjGoTOz-)

Geo Guesser replica, accessible at https://geoguessing.me.

The Mapillary API will be used to generate street-views of a randomly selected city in the world. User clicks a direction to move, and the street-view will be updated as a single-page application.

A game will consist of three rounds. The goal is for the user to guess the location on a map. If the user requires some assistance, a hint button provides aid using AI. At the conclusion of a round, the user can seek further feedback using the AI-review button to learn and improve their guesses.

Stripe and Google OAuth included. Gemini 3.1 used as AI model. PostgreSQL used for database. Caddy used for HTTPS encryption and as a reverse proxy. Docker compose used to build Docker containers. Deployed on a Lightsail virtual machine.

<img width="1289" height="842" alt="image" src="https://github.com/user-attachments/assets/b790603e-deed-4778-ab6c-6c303d36087a" />

Group members:
Saran Srishankar srishan3
Ethan Hapurne hapurnee
Charles Yan Zhao zhaoc133

Authentication: Charles Zhao
We are using Google for OAuth

Look and Feel: Ethan Hapurne
Basic HTML and CSS used to generate front-end. Sample image shown above.

Real-time enablement: Saran Srishankar
Using Mapillary API to provide with street-view panoramas. WebRTC connection used if we need real-time enablements.

AI Integration with MCP / tool: Saran Srishankar
Use Google AI Studio from Gemini. We create an API key and store it into an environment variable. Then all calls to AI will be made via Express routes in the backend.

Stripe Integration: Charles Zhao
Sandbox account key: pk_test_51Tqaj3AbWtyerx9ODYQOZCIZxInj4f27KqbahJEbhxPJeamPcEfghc5EELECCBZt2lOLasuu9PFMwhv2e02AujkC00L4lCZiot

Deployment: Ethan Hapurne
Virtual Machine will be created using Lightsail. Docker will be used to deploy the application. Namecheap used for domain name.
