///
/// Song Handling
///

var Song = function(url, name, artist, album, artwork) {
    ///
    /// Minimum Viable Song 
    ///
    var self = this;
    self.url = url;
    self.name = name;
    self.artist = artist;
    self.album = album;
    self.artwork = artwork;
    return self;
};


///
/// Artwork Handling
///

/// Basic Artwork Handler
var ArtWorker = function(artwork_id, api_key) {
    var self = this;
    self.artwork_id = artwork_id;
    self.api_key = api_key;

    self.setAlbumCover = function(song) {
        $(self.artwork_id).attr("src", song.artwork);
        return false;
    };
};

/// LastFM Artwork Handler
var ArtworkLastFM = function(artwork_id, api_key) {
    var self = this;
    ArtWorker.call(self, artwork_id, api_key);

    self.root_url = "http://ws.audioscrobbler.com/2.0/";

    self.setAlbumCover = function(song) {
        var query_url = 
            this.root_url +
            "?method=album.getinfo" +
            "&artist=" + encodeURI(song.artist) +
            "&album=" + encodeURI(song.album) +
            "&api_key=" + self.api_key +
            "&format=json" +
            "&callback=?";

        var callback = function(data) {
            try {
                var artwork = data.album.image[2]; // large album cover
                var img = artwork['#text']; // honestly, who throws a #?
                $(self.artwork_id).attr("src", img);
            }
            catch(er) {
                $(self.artwork_id).attr("src", null);
            }
        };
        
        $.getJSON(query_url, callback);

        return false;
    };
};


///
/// Media Players
///

/// Artwork + Playlist + Songs + Controls = J2TRON... J2Player!
var J2Player = function(uniq_id, playlist, options, controls, artworker) {
    var self = this; 
    $(self.controlPlayer).jPlayer(options);
    self.options = options;
    self.uniq_id = uniq_id;
    self.playing = 0;
    self.selected = -1;
    self.songs = new Array();
    
    /// Default to basic artworker
    self.artworker = artworker;
    if(typeof(self.artworker) == "undefined") {
        self.artworker = new ArtWorker(controls.artwork);
    }

    /// Assign user provided controls
    self.controlPlayer = controls.player;
    self.controlPlay = controls.play;
    self.controlPause = controls.pause;
    self.controlPrev = controls.prev;
    self.controlNext = controls.next;
    self.controlArtwork = controls.artwork;

    ///
    /// List Handling Functions
    ///

    self.initList = function(playlist) {
        for(idx in playlist) {
            var song = playlist[idx];
            self.addSong(song.url, song.name, song.artist, 
                         song.album, song.artwork);
        }
        return false;
    };

    self.addSong = function(url, name, artist, album, artwork) {
        s = new Song(url, name, artist, album, artwork);
        self.songs.push(s);
        return false;
    };

    self.removeSong = function(index) {
        self.songs.splice(index, 1);
        return false;
    };

    self.size = function() {
        return self.songs.length;
    };

    self.setIndex = function(index) {
        var song = self.songs[index];
        self.selected = index;
        self.artworker.setAlbumCover(song);
        $(self.controlPlayer).jPlayer("setMedia", {mp3: song.url});
        return song;
    };

    ///
    /// Control Buttons
    ///

    /// Play

    self.playSong = function() {
        $(self.controlPlayer).jPlayer("play");
        $(self.controlPlay).fadeOut(function() {
            $(self.controlPause).fadeIn();
        });
        self.playing = 1;
        return false;
    };

    self.playIndex = function(index) {
        var song = self.setIndex(index);
        self.playSong();
        return song;
    };

    $(self.controlPlay).click(this.playSong);

    /// Pause

    self.pauseSong = function() {
        $(self.controlPlayer).jPlayer("pause");
        $(self.controlPause).fadeOut(function() {
            $(self.controlPlay).fadeIn();
        });
        self.playing = 0;
        return true;
    };
        
    $(self.controlPause).click(self.pauseSong);

    /// Prev

    self.playlistPrev = function() {
        var index = 0;
        if (self.selected - 1 >= 0) {
            index = self.selected - 1;
        }
        (self.playing > 0) ? self.playIndex(index) : self.setIndex(index);
        return false;
    };

    $(self.controlPrev).click(self.playlistPrev);

    /// Next

    self.playlistNext = function() {
        var index = 0;
        if (self.selected + 1 < self.size()) {
            index = self.selected + 1;
        }
        (self.playing > 0) ? self.playIndex(index) : self.setIndex(index);
        return false;
    };

    $(self.controlNext).click(self.playlistNext);

    ///
    /// Initialize Instance
    ///

    $(self.controlPlayer).jPlayer(self.options);
    $(self.controlPlayer).hide();
    $(self.controlPause).hide();

    self.initList(playlist);
    self.setIndex(0); // Some users might subclass this
};
$.J2Player = J2Player;

///
/// Tumblr Player
///

var TumblrPlayer = function(uniq_id, posts, options, controls, artworker) {
    var self = this;

    var tumblr_url_footer =
        '?plead=please-dont-download-this-or-our-lawyers-wont-let-us-host-audio';

    var playerCodeToUrl = function(embed_code) {
        /// From: ...src="tumblr.swf?audio_file=http:\/\/path we need"...
        /// To:   http://path we need
        var player = jQuery(embed_code);
        var src = player.attr('src');
        var split_src = src.split('audio_file=');
        var almost_file = split_src[1];
        var file = almost_file.split('&color=');
        var file_url = file[0] + tumblr_url_footer;
        return file_url;
    }

    self.setIndex = function(index) {
        var song = self.playlist[index];
        self.selected = index;
        $(self.controlPlayer).jPlayer("setMedia", {mp3: song.url});
        self.artworker.setAlbumCover(song);
    
        return song;
    }

    /// Convert Tumblr posts to songs
    var playlist = new Array();
    for(var i=0; i < posts.length; i++) {
        var song_post = posts[i];
        var player_code = song_post['audio-player'];
        var file_url = playerCodeToUrl(player_code);
        var song = {
            'url': file_url,
            'name': song_post['id3-title'],
            'artist': song_post['id3-artist'],
            'album': song_post['id3-album']
        } // artwork comes from lastfm loader
        playlist.push(song);
    }

    J2Player.call(self, uniq_id, playlist, options, controls, artworker);
    return self;
}
$.tumblrPlayer = TumblrPlayer;

