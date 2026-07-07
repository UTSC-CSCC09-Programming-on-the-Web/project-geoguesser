[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/sjGoTOz-)

Geo Guesser replica.

The Mapillary API will be used to generate street-views of a randomly selected city in the world. User clicks a direction to move, and the street-view will be updated as a single-page application.

The goal is for the user to guess the location on a map, and will score points based off of their guess accuracy.

AI will be used to provide user feedback (to see what hints they missed in the images and how they can improve). This will be a paid-feature, requiring Stripe integration.

<img width="1915" height="887" alt="image" src="https://github.com/user-attachments/assets/0e3153fe-7985-4628-aade-88b65361c6c1" />

Group members:
Saran Srishankar srishan3
Ethan Hapurne hapurnee
Charles Yan Zhao zhaoc133

Authentication: Charles Zhao
We are using Google for OAuth

Look and Feel: Ethan Hapurne
Will be using React-based frontend. Sample is shown above.

Real-time enablement: Saran Srishankar
Using Mapillary API to provide with street-view panoramas. WebRTC connection used if we need real-time enablements.

AI  Integration with MCP / tool: Saran Srishankar
Use Google AI Studio from Gemini. We create an API key and store it into an environment variable. Then all calls to AI will be made via Express routes in the backend. 

Stripe Integration: Charles Zhao
Sandbox account key: pk_test_51Tqaj3AbWtyerx9ODYQOZCIZxInj4f27KqbahJEbhxPJeamPcEfghc5EELECCBZt2lOLasuu9PFMwhv2e02AujkC00L4lCZiot

Deployment: Ethan Hapurne
Virtual Machine will be created using Digital Ocean. Docker will be used to deploy the application. Namecheap used for domain name.
