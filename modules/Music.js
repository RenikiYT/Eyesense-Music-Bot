const { embedMessage } = require("./embedSimple.js");
const playdl = require("play-dl");
const { QueryType } = require("discord-player");
const { logger } = require("./logger.js");

class Music {
  /**
   * plays music from youtube and various platforms!
   * @param {String} query
   * @param {Message} command
   * @param {Client} client
   * @param {User} user
   * @returns
   */
  async play(query, command, client, user = null) {
    if (!query) throw new Error("No search Query Provided!");

    const searchSong = await client.player.search(query, {
      requestedBy: user ?? undefined,
      searchEngine: QueryType.AUTO,
    });

    if (!searchSong.tracks.length || !searchSong)
      return command.reply({
        embeds: [
          embedMessage(
            "RED",
            `❌ | Song not found, Maybe its age restricted or flagged as offensive by Youtube`
          ),
        ],
      });

    let queue = await client.player.createQueue(command.guildId, {
      leaveOnEnd: false,
      leaveOnStop: true,
      initialVolume: 80,
      leaveOnEmptyCooldown: 60 * 1000 * 3,
      bufferingTimeout: 200,
      leaveOnEmpty: true,
      ytdlOptions: {
        quality: "highestaudio",
        filter: "audioonly",
        highWaterMark: 1 << 25,
        dlChunkSize: 20,
      },
      metadata: {
        channel: command ?? undefined,
      },
      async onBeforeCreateStream(track, source, _queue) {
        if (source === "soundcloud") {
          const client_id = await playdl.getFreeClientID();
          playdl.setToken({
            soundcloud: {
              client_id: client_id,
            },
          });
          if (await playdl.so_validate(track.url)) {
            let soundCloudInfo = await playdl.soundcloud(track.url);
            return (
              await playdl.stream_from_info(soundCloudInfo, { quality: 1 })
            ).stream;
          }
          return;
        }

        if (source === "youtube") {
          const validateSP = playdl.sp_validate(track.url);
          const spotifyList = ["track", "album", "playlist"];
          if (spotifyList.includes(validateSP)) {
            if (playdl.is_expired()) {
              await playdl.refreshToken();
            }
            let spotifyInfo = await playdl.spotify(track.url);
            let youtube = await playdl.search(`${spotifyInfo.name}`, {
              limit: 2,
            });
            return (await playdl.stream(youtube[0].url, { quality: 1 })).stream;
          }

          return (await playdl.stream(track.url, { quality: 1 })).stream;
        }
      },
    });

    try {
      if (!queue.connection) await queue.connect(command.member.voice.channel);
    } catch {
      client.player.deleteQueue(command.guildId);
      queue.destroy(true);
      return await command.reply({
        content: "Could not join your voice channel!",
      });
    }

    searchSong.playlist
      ? queue.addTracks(searchSong.tracks)
      : queue.addTrack(searchSong.tracks[0]);

    if (!queue.playing) {
      try {
        return await queue.play();
      } catch (err) {
        logger(err.message, "error");
        console.log(err);
        await command.reply({
          embeds: [
            embedMessage(
              "RED",
              `❌ | An error occurred while trying to play this song! \nError Message: ${err.message}`
            ),
          ],
        });
      }
    }
  }
}

module.exports = { Music };
