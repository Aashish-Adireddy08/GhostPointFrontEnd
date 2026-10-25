import unittest
from concurrent.futures import ThreadPoolExecutor
from waypoint import WaypointRoom


class WaypointTests(unittest.TestCase):
    def setUp(self):
        self.room = WaypointRoom()
        self.room.register('phone-a', 'hud')
        self.room.register('phone-b', 'hud2')
        self.ref = {'peer': 'Phone-AAAA', 'epoch': 123, 'position': [1, 0, -2]}

    def place(self, token='phone-a', reference=None):
        return self.room.command('set', {'device': token, 'reference': reference or self.ref})

    def test_only_selected_session_can_place_and_replace(self):
        self.assertEqual(self.place()[0], 403)
        self.room.command('grant', {'stream': 'hud'})
        self.assertEqual(self.place('phone-b')[0], 403)
        first = self.place()[1]['point']
        second = self.place()[1]['point']
        self.assertNotEqual(first['id'], second['id'])
        self.assertEqual(self.room.public()['point'], second)
        self.assertNotIn('creator', second)
        self.room.command('grant', {'stream': 'hud2'})
        self.assertEqual(self.place()[0], 403)
        self.assertEqual(self.place('phone-b')[0], 200)

    def test_slot_reuse_cannot_inherit_permission_or_old_waypoint(self):
        self.room.command('grant', {'stream': 'hud'})
        self.place()
        self.room.register('new-phone', 'hud')
        self.assertIsNone(self.room.public()['holder'])
        self.assertIsNone(self.room.public()['point'])
        self.assertEqual(self.place('new-phone')[0], 403)
        self.assertEqual(self.place()[0], 403)

    def test_invalid_coordinates_and_clear(self):
        self.room.command('grant', {'stream': 'hud'})
        for bad in ([float('nan'), 0, 1], [0, 1], [True, 0, 0], [10001, 0, 0]):
            self.assertEqual(self.place(reference={**self.ref, 'position': bad})[0], 400)
        self.place()
        self.room.command('clear', {})
        self.assertIsNone(self.room.public()['point'])

    def test_concurrent_placements_still_leave_exactly_one_point(self):
        self.room.command('grant', {'stream': 'hud'})
        with ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(lambda _: self.place(), range(8)))
        self.assertTrue(all(status == 200 for status, _ in results))
        self.assertIsInstance(self.room.public()['point'], dict)
        self.room.command('grant', {'stream': None})
        self.assertEqual(self.place()[0], 403)

    def test_stale_phone_loses_permission(self):
        self.room.command('grant', {'stream': 'hud'})
        self.place()
        self.room.phones['phone-a']['seen'] -= 31
        state = self.room.public()
        self.assertIsNone(state['holder'])
        self.assertIsNone(state['point'])

    def test_names_placement_metadata_and_rename(self):
        self.room.command('grant', {'stream': 'hud'})
        status, state = self.room.command('set', {'device': 'phone-a', 'reference': self.ref, 'name': '  Loading   bay  ', 'placement': 'feature'})
        self.assertEqual(status, 200)
        self.assertEqual(state['point']['name'], 'Loading bay')
        self.assertEqual(state['point']['placement'], 'feature')
        original_id = state['point']['id']
        status, state = self.room.command('rename', {'device': 'phone-a', 'name': 'Exit A'})
        self.assertEqual(status, 200)
        self.assertEqual(state['point']['name'], 'Exit A')
        self.assertEqual(state['point']['id'], original_id)
        for name in ('x' * 41, 'bad\x00name', 123):
            self.assertEqual(self.room.command('rename', {'name': name})[0], 400)
        self.assertEqual(self.room.command('set', {'device': 'phone-a', 'reference': self.ref, 'placement': 'unknown'})[0], 400)

    def test_phone_clear_and_rename_require_selected_session(self):
        self.room.command('grant', {'stream': 'hud'})
        self.place()
        self.assertEqual(self.room.command('clear', {'device': 'phone-b'})[0], 403)
        self.assertEqual(self.room.command('rename', {'device': 'phone-b', 'name': 'Wrong phone'})[0], 403)
        self.assertIsNotNone(self.room.public()['point'])
        status, state = self.room.command('clear', {'device': 'phone-a'})
        self.assertEqual(status, 200)
        self.assertIsNone(state['point'])
        self.assertEqual(self.room.command('rename', {'device': 'phone-a', 'name': 'Gone'})[0], 409)


if __name__ == '__main__':
    unittest.main()
