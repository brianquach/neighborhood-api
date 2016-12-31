var restaurantModel = (function($) {
  'use strict'

  var headers = {
    "user-key": '3dcc424e9b2d38abdfd2d55ae0c36d06'
  };

  var restaurants;

  function getRestaurants() {
    var d = $.Deferred();

    if (restaurants) {
      return d.resolve(restaurants);
    }

    var data = $.param({
      lat: mapState.lat,
      lon: mapState.lng,
      q: 'cafe',
      count: 15,
      radius: 8050  // unit in meters; ~5 miles
    });
    var url = 'https://developers.zomato.com/api/v2.1/search';

    $.ajax({
      url: url,
      data: data,
      headers: headers
    }).done(function(data) {
      var restaurants = data.restaurants;
      d.resolve(restaurants);
    }).fail(function (jqXHR, textStatus, errorThrown) {
      // TODO: Handle failures
      // console.log(jqXHR, textStatus, errorThrown);
    });

    return d;
  }

  function getRestaurantReviews(restaurantId) {
    var d = $.Deferred();

    var data = $.param({
      res_id: restaurantId,
    });
    var url = 'https://developers.zomato.com/api/v2.1/reviews';

    $.ajax({
      url: url,
      data: data,
      headers: headers
    }).done(function(data) {
      var reviews = data.user_reviews;
      d.resolve(reviews);
    }).fail(function (jqXHR, textStatus, errorThrown) {
      // TODO: Handle failures
      // console.log(jqXHR, textStatus, errorThrown);
    });

    return d;
  }

  function saveRestaurants(unsavedRestaurants) {
    restaurants = unsavedRestaurants;
  }

  return {
    getRestaurants: getRestaurants,
    saveRestaurants: saveRestaurants,
    getRestaurantReviews: getRestaurantReviews
  }
})(jQuery);

var mapModel = (function($) {
  'use strict'

  var markerCluster;

  function getMarkerCluster() {
    return markerCluster;
  }

  function saveMarkerCluster(unsavedMarkerCluster) {
    markerCluster = unsavedMarkerCluster;
  }

  return {
    getMarkerCluster: getMarkerCluster,
    saveMarkerCluster: saveMarkerCluster
  }
})();

var mapController = (function($) {
  'use strict'

  function animateMarker(marker, timeout) {
    timeout = timeout || 1400;
    marker.setAnimation(google.maps.Animation.BOUNCE);
    window.setTimeout(function() {
      marker.setAnimation(null);
    }, timeout);
  }

  function getRestaurantReviews(restaurantId) {
    $.when(restaurantModel.getRestaurantReviews(restaurantId)).then(
      function (reviews) {
        // console.log('2', reviews);
      }
    );
  }

  function addMarker(lat, lng, name, restaurantId) {
    var position = {
      lat: lat,
      lng: lng
    };
    var marker = new google.maps.Marker({
      position: position,
      title: name
    });

    marker.addListener('click', function() {
      getRestaurantReviews(restaurantId);
      animateMarker(marker);
      map.setZoom(16);
      map.panTo(marker.getPosition());
    });

    return marker;
  }

  return {
    addMarker: addMarker,
    animateMarker: animateMarker
  };
})(jQuery);

var cafeModule = (function ($) {
  'use strict'

  var cafeViewModel = new CafeViewModel();
  function CafeViewModel() {
    var self = this;
    self.restaurants = ko.observableArray();
    self.restaurantClick = function(restaurantObj) {
      if (self.isMobileListView()) {
        self.isMobileListView(false);
      }
      google.maps.event.trigger(restaurantObj.marker, 'click');
    };

    self.query = ko.observable();
    self.query.extend({ rateLimit: 200 }); // Imitate debouncing
    self.query.subscribe(function(q) {
      var name, i, len, restaurantObj, restaurant, marker;
      var re = new RegExp(q, 'gi');

      var markerCluster = mapModel.getMarkerCluster();
      markerCluster.clearMarkers();

      for (i = 0, len = self.restaurants().length; i < len; i++) {
        restaurantObj = self.restaurants()[i];
        restaurant = restaurantObj.restaurant;
        marker = restaurantObj.marker;
        name = restaurantObj.restaurant.name;
        if (name.match(re)) {
          marker.setVisible(true);
          markerCluster.addMarker(marker);
          restaurant.show(true);
        } else {
          marker.setVisible(false);
          restaurant.show(false);
        }
      };
    });

    self.isMobileListView = ko.observable(false);
    self.mobileListView = function() {
      self.isMobileListView(true);
    };
    self.mobileMapView = function() {
      self.isMobileListView(false);
    };
  }

  function init() {
    $.when(restaurantModel.getRestaurants()).then(
      function (restaurants) {
        var restaurant, location, lat, lng, marker;
        var bounds = map.getBounds();
        var markers = [];

        restaurants.forEach(function (restaurantObj, idx) {
          restaurant = restaurantObj.restaurant;
          location = restaurant.location;
          lat = location.latitude;
          lng = location.longitude;
          if (typeof lat !== 'Number') {
            lat = Number(lat);
          }
          if (typeof lng !== 'Number') {
            lng = Number(lng);
          }
          if (lat !== 0 && lng !== 0) {
            marker = mapController.addMarker(
              lat, lng, restaurant.name, restaurant.id);
            markers.push(marker);
            bounds.extend(marker.getPosition());
            restaurantObj.marker = marker;
            restaurant.show = ko.observable(true);
            cafeViewModel.restaurants.push(restaurantObj);
          }
        });

        var markerCluster = new MarkerClusterer(
          map,
          markers,
          {imagePath: './static/images/m'}
        );
        map.fitBounds(bounds);
        mapModel.saveMarkerCluster(markerCluster);
        restaurantModel.saveRestaurants(restaurants);

        ko.applyBindings(cafeViewModel);
      }
    );
  }

  return {
    init: init
  };
})(jQuery);

$(document).ready(function() {
  cafeModule.init();
});
