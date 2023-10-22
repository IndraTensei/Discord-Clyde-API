import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Discord from 'discord.js-selfbot-v13';
import rateLimit from 'express-rate-limit';

const app = express();
app.set('trust proxy', 1);

// Initialize Discord
const client = new Discord.Client();
let discord_ready = false;
const clyde_user_id = process.env.CLYDE_USER_ID || '1081004946872352958';

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    discord_ready = true;
    // Prune channels on startup
    pruneChannels(process.env.SERVER_ID);
});

async function sendMessageToChannel(id, message) {
    const channel = await client.channels.fetch(id);
    channel.send(message);
}

async function createChannelinServer(serverId, channelName) {
    const server = await client.guilds.fetch(serverId);
    const channel = await server.channels.create(channelName, {
        type: 'text',
        permissionOverwrites: [
            {
                id: server.roles.everyone,
                deny: ['VIEW_CHANNEL'],
            },
        ],
    });
    return channel;
}

async function getChannelByName(serverId, channelName) {
    const server = await client.guilds.fetch(serverId);
    const channels = await server.channels.fetch();
    const channel = channels.find((channel) => channel.name === channelName);
    return channel;
}

async function deleteAllChannels(serverId) {
    const server = await client.guilds.fetch(serverId);
    const channels = await server.channels.fetch();
    channels.forEach(async (channel) => {
        console.log(`Deleting channel ${channel.name}`);
        await channel.delete();
    });
}

async function getChannelCount(serverId) {
    const server = await client.guilds.fetch(serverId);
    const channels = await server.channels.fetch();
    return channels.size;
}

async function pruneChannels(serverId, max = 450) {
    const channelCount = await getChannelCount(serverId);
    if (channelCount > max) {
        console.log(`Channel count is ${channelCount}, deleting all channels...`);
        await deleteAllChannels(serverId);
    } else {
        console.log(`Channel count is ${channelCount}, not deleting channels.`);
    }
}

setInterval(() => {
    pruneChannels(process.env.SERVER_ID);
}, 15 * 60 * 1000);

app.use(cors());

if (process.env.RATELIMIT_MAX_RPS) {
    const ratelimit_max = parseInt(process.env.RATELIMIT_MAX_RPS) || 10;
    console.log(`Rate limiting to ${ratelimit_max} requests per second`);
    app.use(rateLimit({
        windowMs: 1000, // 1 second
        max: ratelimit_max,
    }));
} else {
    console.log(`Rate limiting disabled`);
}

app.get('/healthcheck', async (req, res) => {
    res.json({
        status: discord_ready ? 'ok' : 'not ready',
    });
});

app.get('/', async (req, res) => {
    if (!discord_ready) {
        res.status(400).json({
            error: 'Discord is not ready yet',
        });
        return;
    }

    const message = req.query.message;
    const conversationID = req.query.conversationID.toLowerCase();

    if (!message || !conversationID) {
        res.status(400).json({
            error: 'Please provide a message and conversationID',
        });
        return;
    }

    if (message.length > 1850) {
        res.status(400).json({
            error: 'Message is too long. Must be under 1850 characters',
        });
        return;
    }

    if (!/^[a-zA-Z0-9]{1,32}$/.test(conversationID)) {
        res.status(400).json({
            error: 'Invalid conversationID. Must be a string with only letters and numbers, no spaces and no more than 32 characters',
        });
        return;
    }

    let channel = await getChannelByName(process.env.SERVER_ID, conversationID);
    if (!channel) {
        channel = await createChannelinServer(process.env.SERVER_ID, conversationID);
    }

    await sendMessageToChannel(channel.id, `<@${clyde_user_id}> ${message}`);

    const response = await new Promise((resolve, reject) => {
        client.on('messageCreate', (msg) => {
            if (msg.channel.id === channel.id && msg.author.id === clyde_user_id) {
                resolve(msg.content);
            }
        });
    });

    res.json({
        response: response,
    });
});

app.delete('/', async (req, res) => {
    if (!discord_ready) {
        res.status(400).json({
            error: 'Discord is not ready yet',
        });
        return;
    }

    const conversationID = req.query.conversationID.toLowerCase();

    if (!conversationID) {
        res.status(400).json({
            error: 'Please provide a conversationID',
        });
        return;
    }

    if (!/^[a-zA-Z0-9]{1,32}$/.test(conversationID)) {
        res.status(400).json({
            error: 'Invalid conversationID. Must be a string with only letters and numbers, no spaces and no more than 32 characters',
        });
        return;
    }

    let channel = await getChannelByName(process.env.SERVER_ID, conversationID);
    if (!channel) {
        res.json({
            error: 'Conversation does not exist',
        });
        return;
    }
    await channel.delete();

    res.json({
        response: 'Conversation deleted',
        success: true,
    });
});

client.login(process.env.TOKEN);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
