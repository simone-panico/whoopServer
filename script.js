const express = require("express");
const axios = require("axios");
const querystring = require("querystring");
const crypto = require("crypto");
const mongoose = require("mongoose");
require('dotenv').config();
const Token = require('./models/Token');
const app = express();
const fs = require("fs")
const https = require("https")

const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const redirectUri = process.env.REDIRECT_URI;
const authEndpoint = "https://api.prod.whoop.com/oauth/oauth2/auth";
const tokenEndpoint = "https://api.prod.whoop.com/oauth/oauth2/token";
const refreshEndpoint = "https://api.prod.whoop.com/oauth/oauth2/token";

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

let state = "";

app.get("/auth", (req, res) => {
  state = crypto.randomBytes(8).toString("hex");
  const authUrl = `${authEndpoint}?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=read:recovery read:cycles read:workout read:sleep read:profile read:body_measurement&state=${state}`;
  res.redirect(authUrl);
});

app.get("/callback", async (req, res) => {
  const code = req.query.code;
  const returnedState = req.query.state;

  // Validate the state parameter
  if (returnedState !== state) {
    res.status(400).send("Invalid state parameter");
    return;
  }

  try {
    const response = await axios.post(
      tokenEndpoint,
      querystring.stringify({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const { access_token, refresh_token, expires_in } = response.data;
    console.log(response.data)
    console.log(access_token, refresh_token);

    const token = new Token({
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresIn: expires_in,
    }); 
    await token.save();

    res.send(access_token);

  } catch (error) {
    console.error(error);
    res.status(500).send("Authentication failed");
  }
});

const getToken = async () => {
  let token = await Token.findOne().sort({ createdAt: -1 });

  if (!token || token.isExpired()) {
    if (token && token.refreshToken) {
      try {
        const response = await axios.post(
          refreshEndpoint,
          querystring.stringify({
            refresh_token: token.refreshToken,
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "refresh_token",
          }),
          {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
          }
        );

        const { access_token, refresh_token, expires_in } = response.data;

        token.accessToken = access_token;
        token.refreshToken = refresh_token || token.refreshToken;
        token.expiresIn = expires_in;
        token.createdAt = new Date();

        await token.save();
      } catch (error) {
        console.error('Error refreshing token:', error);
        throw new Error('Failed to refresh token');
      }
    } else {
      throw new Error('No valid token available');
    }
  }

  return token.accessToken;
};

app.get("/recovery", async (req, res) => {
  try {
    const accessToken = await getToken();

    const response = await axios.get(
      "https://api.prod.whoop.com/developer/v1/recovery",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to fetch recovery data");
  }
});

app.get("/cycle", async (req, res) => {
  try {
    const accessToken = await getToken();

    const response = await axios.get(
      "https://api.prod.whoop.com/developer/v1/cycles",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to fetch cycle data");
  }
});


app.get("/sleep", async (req, res) => {
  try {
    const accessToken = await getToken();

    const response = await axios.get(
      "https://api.prod.whoop.com/developer/v1/activity/sleep",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to fetch cycle data");
  }
});

app.get("/body", async (req, res) => {
  try {
    const accessToken = await getToken();

    const response = await axios.get(
      "https://api.prod.whoop.com/developer/v1/user/measurement/body",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to fetch cycle data");
  }
});


app.get("/basic", async (req, res) => {
  try {
    const accessToken = await getToken();

    const response = await axios.get(
      "https://api.prod.whoop.com/developer/v1/user/profile/basic",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to fetch cycle data");
  }
});


app.get("/workout/:id?", async (req, res) => {
  try {
    const accessToken = await getToken();
    const nextToken = req.params.id || null; 
    const response = await fetchWorkouts(accessToken, nextToken);
    res.json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to fetch workout data");
  }
});

async function fetchWorkouts(accessToken, nextToken = null) {
  const url = "https://api.prod.whoop.com/developer/v1/activity/workout";
  let config = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    params: {}
  };

  if (nextToken) {
    config.params.nextToken = nextToken;
  }

  const response = await axios.get(url, config);
  return response; 
}


const sslOptions = {
key: fs.readFileSync("/home/simone/whoopServer/https/selfsigned.key"),
cert: fs.readFileSync("/home/simone/whoopServer/https/selfsigned.crt"),
};

https.createServer(sslOptions, app).listen(4000, () => {
console.log("HTTPS Server running on https://144.2.115.87:4000");
});
