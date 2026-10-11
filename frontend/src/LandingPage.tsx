import {
  ArrowRight,
  CalendarDays,
  Check,
  CirclePlay,
  Compass,
  Music2,
  ScanLine,
  Sparkles,
  Ticket,
  Trophy,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "./api";
import type { Event } from "./types";
import ThemeToggle from "./ThemeToggle";

export default function LandingPage({
  dashboardPath,
}: {
  dashboardPath?: string;
}) {
  const enterPath = dashboardPath || "/login";
  const eventsPath = dashboardPath ? `${dashboardPath}/events` : "/login";
  const [events, setEvents] = useState<Event[]>([]);
  const [eventError, setEventError] = useState("");
  useEffect(() => {
    void api
      .events()
      .then(setEvents)
      .catch((error: unknown) =>
        setEventError(
          error instanceof Error ? error.message : "Could not load events.",
        ),
      );
  }, []);
  return (
    <main className="landing">
      <header className="landing-nav">
        <Link to="/" className="landing-brand">
          <span>
            <Sparkles size={18} />
          </span>
          FestiQO
        </Link>
        <nav>
          <a href="#events">Explore</a>
          <a href="#experience">The experience</a>
          <a href="#about">About the fest</a>
        </nav>
        <ThemeToggle compact />
        <Link to={enterPath} className="landing-signin">
          {dashboardPath ? "Go to dashboard" : "Sign in"}{" "}
          <ArrowRight size={16} />
        </Link>
      </header>
      <section className="landing-hero">
        <div className="landing-copy">
          <span className="landing-kicker">
            <i /> YUKTI · OCT 15–17, 2026
          </span>
          <h1>
            Three days.
            <br />
            One <em>big feeling.</em>
          </h1>
          <p>
            Ideas worth chasing. People worth meeting. Moments you’ll keep long
            after the lights come up.
          </p>
          <div className="landing-actions">
            <Link to={eventsPath} className="landing-button dark">
              Find your event <ArrowRight size={17} />
            </Link>
            <a className="landing-watch" href="#experience">
              <span>
                <CirclePlay size={18} />
              </span>
              Get to know FestiQO
            </a>
          </div>
          <div className="landing-proof">
            <div className="landing-avatars">
              <img src="https://i.pravatar.cc/80?img=11" />
              <img src="https://i.pravatar.cc/80?img=32" />
              <img src="https://i.pravatar.cc/80?img=12" />
            </div>
            <span>
              <b>
                {events
                  .reduce((sum, event) => sum + event.registered, 0)
                  .toLocaleString()}
              </b>{" "}
              registered spots
            </span>
          </div>
        </div>
        <div className="landing-visual">
          <div className="landing-photo">
            <img
              src="https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=1100&q=85"
              alt="A crowd enjoying a live music festival"
            />
          </div>
          <div className="landing-date-card">
            <CalendarDays size={17} />
            <span>
              <b>OCT 15—17</b>
              <small>Three days on campus</small>
            </span>
          </div>
          <div className="landing-fun-card">
            <span>
              MAKE
              <br />
              SOME
              <br />
              <em>NOISE.</em>
            </span>
            <Music2 size={22} />
          </div>
          <span className="landing-stamp">
            NORTH
            <br />
            CAMPUS
            <br />
            2026
          </span>
        </div>
        <div className="landing-side-note">
          GOOD PEOPLE. BIG IDEAS. GREAT STORIES.
        </div>
      </section>
      <section className="landing-facts">
        <span>
          <b>{events.length}</b> events to get into
        </span>
        <i />
        <span>
          <b>3</b> days to make yours
        </span>
        <i />
        <span>
          <b>1</b> campus, all yours
        </span>
        <i />
        <span>
          <b>∞</b> stories to take home
        </span>
      </section>
      <section id="events" className="landing-events">
        <div className="landing-section-head">
          <div>
            <span className="landing-kicker">FIND YOUR KIND OF FUN</span>
            <h2>
              There’s a little something
              <br />
              for every kind of curious.
            </h2>
          </div>
          <Link to={eventsPath}>
            Explore all events <ArrowRight size={16} />
          </Link>
        </div>
        {eventError && <p role="alert">{eventError}</p>}
        <div className="landing-event-grid">
          {events.map((event, i) => (
            <article className="landing-event" key={event.id}>
              <div className="landing-event-photo">
                <img src={event.image || undefined} alt="" />
                <span>{event.category}</span>
                <b>0{i + 1}</b>
              </div>
              <div className="landing-event-content">
                <h3>{event.title}</h3>
                <p>{event.description}</p>
                <div>
                  <span>
                    <CalendarDays size={14} />
                    {new Date(`${event.date}T00:00:00`).toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric" },
                    )}{" "}
                    · {event.time}
                  </span>
                  <span>
                    <Users size={14} />
                    {event.registered} joining
                  </span>
                </div>
              </div>
            </article>
          ))}
          {!eventError && events.length === 0 && (
            <p>No published events yet. Check back soon.</p>
          )}
        </div>
      </section>
      <section id="experience" className="landing-experience">
        <div className="landing-experience-copy">
          <span className="landing-kicker">THE FEST, MADE EASY</span>
          <h2>
            Less figuring it out.
            <br />
            <em>More being there.</em>
          </h2>
          <p>
            Your whole festival life, together in one place. Find what’s on,
            save your spot, and walk in ready.
          </p>
          <Link to={enterPath} className="landing-button white">
            Step inside <ArrowRight size={16} />
          </Link>
        </div>
        <div className="landing-benefits">
          <div>
            <span>
              <Compass />
            </span>
            <b>Find your next thing</b>
            <p>Discover the events, ideas, and people you came for.</p>
          </div>
          <div>
            <span>
              <Ticket />
            </span>
            <b>Your ticket, always ready</b>
            <p>One simple digital pass for getting through the door.</p>
          </div>
          <div>
            <span>
              <Trophy />
            </span>
            <b>Play along</b>
            <p>Quick quizzes, friendly scores, and bragging rights.</p>
          </div>
          <div>
            <span>
              <ScanLine />
            </span>
            <b>Walk right in</b>
            <p>Fast QR check-in helps the fun start on time.</p>
          </div>
        </div>
      </section>
      <section id="about" className="landing-final">
        <span className="landing-kicker">YOUR CAMPUS IS CALLING</span>
        <h2>
          Make room for a<br />
          <em>really good story.</em>
        </h2>
        <Link to={eventsPath} className="landing-button dark">
          Explore the fest <ArrowRight size={17} />
        </Link>
        <span className="landing-final-mark">
          <Check size={18} /> OCTOBER 15—17 · YUKTI
        </span>
      </section>
      <footer className="landing-footer">
        <Link to="/" className="landing-brand">
          <span>
            <Sparkles size={16} />
          </span>
          FestiQO
        </Link>
        <small>Made for the moments that bring us together.</small>
        <span>© 2026 YUKTI Fest</span>
      </footer>
    </main>
  );
}
