import { token } from './config.json';
import { Bot } from "./Utils/Bot";

export const client = new Bot()


client.music.on("connect", () => {
	console.log(`connected to lavalink`)
});



client.login(token)


