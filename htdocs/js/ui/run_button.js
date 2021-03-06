RCloud.UI.run_button = (function() {
    var run_button_ = $("#run-notebook"),
        running_ = false,
        queue_ = [],
        cancels_ = [],
        stop_interval_ = null;

    function display(icon, title) {
        $('i', run_button_).removeClass().addClass(icon);
        run_button_.attr('title', title);
    }

    function start_queue() {
        if(queue_.length === 0) {
            running_ = false;
            display('icon-play', 'Run All');
            return Promise.resolve(undefined);
        }
        else {
            running_ = true;
            var first = queue_.shift();
            display('icon-stop', 'Stop');
            return first().then(function() {
                cancels_.shift();
                return start_queue();
            });
        }
    }
    return {
        init: function() {
            var that = this;
            run_button_.click(function() {
                if(running_)
                    that.stop();
                else
                    shell.run_notebook();
            });
            RCloud.session.listeners.push({
                on_reset: function() {
                    that.on_stopped();
                }
            });
        },
        stop: function() {
            rcloud.signal_to_compute(2) // SIGINT
                .then(function() {
                    stop_interval_ = window.setInterval(function() {
                        run_button_.animate({opacity: 0.5}, 250, "easeOutCirc")
                            .animate({opacity: 1.0}, 250, "easeOutCirc");
                    }, 1000);
                });
        },
        on_stopped: function() {
            cancels_.forEach(function(cancel) { cancel(); });
            queue_ = [];
            cancels_ = [];
            running_ = false;
            display('icon-play', 'Stop');
        },
        enqueue: function(f, cancel) {
            var that = this;
            queue_.push(f);
            cancels_.push(cancel || function() {});
            if(!running_) {
                start_queue()
                    .catch(function(xep) {
                        if(stop_interval_) {
                            window.clearInterval(stop_interval_);
                            stop_interval_ = null;
                        }
                        console.log(xep);
                        that.on_stopped();
                        // if this was due to a SIGINT, we're done
                        // otherwise we'll need to report this.
                        // stop executing either way.
                        if(!/^ERROR FROM R SERVER: 127/.test(xep))
                            throw xep;
                    });
            }
        }
    };
})();
