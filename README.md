[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/sjGoTOz-)

Geo Guesser replica, accessible at https://geoguessing.me.

The Mapillary API will be used to generate street-views of a randomly selected city in the world. User clicks a direction to move, and the street-view will be updated as a single-page application. Real-time enablement implemented to allow a game to be updated if a user plays on multiple devices.

A game will consist of three rounds. The goal is for the user to guess the location on a map. If the user requires some assistance, a hint button provides aid using AI. At the conclusion of a round, the user can seek further feedback using the AI-review button to learn and improve their guesses.

Stripe and Google OAuth included. Gemini 3.1 used as AI model. PostgreSQL used for database. Angular-based frontend. RESTful backend. Caddy used for HTTPS encryption and as a reverse proxy. Docker compose used to build Docker containers. Deployed on a Lightsail virtual machine.

<img width="1879" height="882" alt="image" src="https://github.com/user-attachments/assets/a5654a20-ad3c-4639-96cb-79177c359688" />

Group members:
Saran Srishankar srishan3
Ethan Hapurne hapurnee
Charles Yan Zhao zhaoc133

Authentication: Charles
Google for OAuth

Look and Feel: Ethan and Saran
Angular frontend

Real-time enablement: Saran
Mapillary API to provide street-view panoramas. Server-sent events for synchronizing games across multiple devices.

AI Integration with MCP / tool: Saran
Gemini-3.1-flash-lite used for AI.

Stripe Integration: Charles

Deployment: Ethan
Lightsail for VM. Docker and Docker compose for deployment. Namecheap for domain name.
